"use strict";
import fs from "fs";
import gulp from "gulp";
import browserify from "browserify";
import watchify from "watchify";
import babelify from "babelify";
import source from "vinyl-source-stream";
import buffer from "vinyl-buffer";
import sourcemaps from "gulp-sourcemaps";
import log from "fancy-log";
import alias from "awesome-aliasify";
// const gutil = require("gulp-util");
import gulpSass from "gulp-sass";
import sass from "node-sass";
import postcss from "gulp-postcss";
import autoprefixer from "autoprefixer";
import cleanCSS from "gulp-clean-css";
import streamToPromise from "stream-to-promise";
import debounce from "lodash.debounce"
import terser from "gulp-terser"
import through2 from "through2";
import commonShake from "common-shakeify";

// const babelrc = JSON.parse(fs.readFileSync('./babelrc.json'));

// create `build:app-css`
gulp.task("build:css", _ => {
  const pipeSass = gulpSass(sass)
  return gulp.src([`./src/app.scss`], {
      allowEmpty: true
  })
    .pipe(pipeSass().on('error', pipeSass.logError))
    .pipe(postcss([autoprefixer()]))
    .pipe(cleanCSS())
    .pipe(gulp.dest('./dist/'))
})

gulp.task('build-watch:css', gulp.parallel('build:css', function () {
  gulp.watch('./src/**/*.scss', gulp.series('build:css'));
}));

const b = browserify({
    entries:"./src/index.js",
    standalone:"app",
    // debug: process.env.IS_BEFORE_PUSH ? false : true
})
.transform(babelify)
.plugin(commonShake)
.plugin(alias,{
    antd: "global.antd",
    react: "global.React",
    "react-dom": "global.ReactDOM",
    "ramda": "global.R",
    "fs": "./src/polyfill/fs.js",
    "util": "./src/polyfill/util.js"
})

gulp.task("build", _ => {
    return bundle(b);
});

gulp.task("build-watch", _ => {
    let bw = watchify(b, {
        poll: true
    });
    let streaming = null;
    bw.on("update", debounce(_ => {
        log("source updated start bundle ...")
        if (streaming) {
            streaming.pause();
            // console.log(streaming.destory, streaming.close);
        }
        streaming = bundle(bw);
        streamToPromise(streaming)
            .then(_ => log("finsihed ..."))
    }, 500));
    streaming = bundle(bw);
})

function bundle(b) {
    return b.bundle()
        .on('error', e=>log(e))
        .pipe(source('app.js'))
        .pipe(buffer())
        .pipe(process.env.IS_BEFORE_PUSH ? terser({ output: { comments: false, beautify: false } }) : through2.obj())
        // .pipe(sourcemaps.init({loadMaps: true}))
        // Add transformation tasks to the pipeline here.
        // .pipe(sourcemaps.write())
        .pipe(gulp.dest('./dist/'));
}
