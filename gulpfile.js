var gulp = require('gulp');
var args = require('yargs').argv;
var browserSync = require('browser-sync');
var config = require('./gulp.config')();
var del = require('del');
var $ = require('gulp-load-plugins')({
    lazy: true
});
var port = process.env.PORT || config.defaultPort;

gulp.task('help', $.taskListing); // This is the equivalent of the next task.
gulp.task('default', ['help']);

//gulp.task('help', function () {
//    $.taskListing();
//});

gulp.task('vet', function () {
    log('Analyzing source with JSHint and JSCS');

    return gulp
        .src(config.alljs)
        .pipe($.if(args.verbose, $.print()))
        .pipe($.jscs())
        .pipe($.jshint())
        .pipe($.jshint.reporter('jshint-stylish', {
            verbose: true
        }))
        .pipe($.jshint.reporter('fail'));
});

gulp.task('clean', function (done) {
    var delconfig = [].concat(config.build, config.temp);
    log('Cleaning: ' + $.util.colors.cyan(delconfig));
    //del(delconfig, done);

    return gulp
        .src(delconfig, {
            read: false
        })
        .pipe($.clean());
});

gulp.task('clean-fonts', function (done) {
    //clean(config.build + 'fonts/**/*.*', done);
    //del([config.build + 'fonts/**/*.*'], done);

    return gulp
        .src(config.build + 'fonts/**/*.*', {
            read: false
        })
        .pipe($.clean());
});

gulp.task('clean-images', function (done) {
    //clean(config.build + 'images/**/*.*', done);
    //del(config.build + 'images/**/*.*', done);

    return gulp
        .src(config.build + 'images/**/*.*', {
            read: false
        })
        .pipe($.clean());
});

gulp.task('clean-styles', function (done) {
    //clean(config.temp + '**/*.css', done);
    //del(config.temp + '**/*.css', done);

    var files = [].concat(
        config.temp + '**/*.css',
        config.build + 'styles/**/*.css'
    );

    return gulp
        .src(files, {
            read: false
        })
        .pipe($.clean());
});

gulp.task('styles', ['clean-styles'], function () {

    log('Compiling Less --> CSS');

    return gulp
        .src(config.less)
        .pipe($.plumber())
        .pipe($.less())
        .pipe($.autoprefixer({
            browsers: ['last 2 version', '> 5%']
        }))
        .pipe(gulp.dest(config.temp));
});

gulp.task('fonts', ['clean-fonts'], function () {

    log('Copying fonts');

    return gulp
        .src(config.fonts)
        .pipe(gulp.dest(config.build + 'fonts'));
});

gulp.task('images', ['clean-images'], function () {

    log('Copying and compressing the images');

    return gulp
        .src(config.images)
        .pipe($.imagemin({
            optimizationLevel: 4
        }))
        .pipe(gulp.dest(config.build + 'images'));
});

gulp.task('clean-code', function (done) {

    var files = [].concat(
        config.temp + '**/*.js',
        config.build + '**/*.html',
        config.build + 'js/**/*.js'
    );

    log('Cleaning files: ', files);

    return gulp
        .src(files)
        .pipe($.clean());
    //clean(files, done);
});

gulp.task('templatecache', ['clean-code'], function () {
    log('Creating AngularJS $templateCache');

    return gulp
        .src(config.htmltemplates)
        .pipe($.minifyHtml({
            empty: true
        }))
        .pipe($.angularTemplatecache(
            config.templateCache.file,
            config.templateCache.options))
        .pipe(gulp.dest(config.temp));
});

gulp.task('less-watcher', function () {
    gulp.watch([config.less], ['styles']);
});

gulp.task('wiredep', function () {
    log('Wire up the bower css js and our app js into the html');
    var options = config.getWiredepDefaultOptions();
    var wiredep = require('wiredep').stream;

    return gulp
        .src(config.index)
        .pipe(wiredep(options))
        .pipe($.inject(gulp.src(config.js)))
        .pipe(gulp.dest(config.client));
});

gulp.task('inject', ['wiredep', 'styles', 'templatecache'], function () {
    log('Wire up the app css into the html, and call wiredep ');

    return gulp
        .src(config.index)
        .pipe($.inject(gulp.src(config.css)))
        .pipe(gulp.dest(config.client));
});

gulp.task('optimize', ['inject'], function () {

    log('Optmizing the javascript, css, html files');

    // var assets = $.useref.assets({
    //     searchPath: './'
    // });
    var templateCache = config.temp + config.templateCache.file;
    var cssFilter = $.filter('**/*.css', {
        restore: true
    });
    var jsLibFilter = $.filter('**/' + config.optimized.lib, {
        restore: true
    });

    var jsAppFilter = $.filter('**/' + config.optimized.app, {
        restore: true
    });

    return gulp
        .src(config.index)
        .pipe($.plumber())
        .pipe($.inject(gulp.src(templateCache, {
            read: false
        }), {
            starttag: '<!-- inject:templates:js -->'
        }))
        // .pipe(assets)
        // .pipe(assets.restore())
        .pipe(cssFilter)
        .pipe($.minifyCss())
        // .pipe($.cleanCss({
        //     debug: true
        // }, function (details) {
        //     console.log(details.name + ':' + details.stats.originalSize);
        //     console.log(details.name + ':' + details.stats.minifiedSize);
        // }))
        .pipe(cssFilter.restore)
        .pipe(jsLibFilter)
        .pipe($.uglify())
        .pipe(jsLibFilter.restore)
        .pipe(jsAppFilter)
        .pipe($.ngAnnotate({ add: true }))
        .pipe($.uglify())
        .pipe(jsAppFilter.restore)
        .pipe($.useref({
            searchPath: './'
        }))
        .pipe($.if('*.js', $.uglify()))
        .pipe($.if('*.css', $.minifyCss()))
        .pipe(gulp.dest(config.build));
});

gulp.task('serve-build', ['optimize'], function () {
    serve(false /* isDev = false */ );
});

gulp.task('serve-dev', ['inject'], function () {
    serve(true /* isDev = true */ );
});

////////////

function serve(isDev) {

    //var isDev = true;

    var nodeOptions = {
        script: config.nodeServer,
        delayTime: 1,
        env: {
            'PORT': port,
            'NODE_ENV': isDev ? 'dev' : 'build'
        },
        watch: [config.server] //
    };

    $.nodemon(nodeOptions)
        .on('restart', function (ev) {
            log('*** nodemon restarted');
            log('files changed on restart:\n ' + ev);
            setTimeout(function () {
                browserSync.notify('reloading now...');
                browserSync.reload({
                    stream: false
                });
            }, config.browserReloadDelay);
        })
        .on('start', function () {
            log('*** nodemon started');
            startBrowserSync(isDev);
        })
        .on('crash', function () {
            log('*** nodemon crashed: script crashed for some reason');
        })
        .on('exit', function () {
            log('*** nodemon exited cleanly');
        });

}

function changeEvent(event) {
    var srcPattern = new RegExp('/.*(?=/' + config.source + ')/');
    log('File ' + event.path.replace(srcPattern, '') + ' ' + event.type);
}

function startBrowserSync(isDev) {

    if (args.nosync || browserSync.active) {
        return;
    }

    log('Starting brower-sync on port ' + port);

    if (isDev) {
        gulp.watch([config.less], ['styles'])
            .on('change', function (event) {
                changeEvent(event);
            });
    } else {
        gulp.watch([config.less, config.js, config.html], ['optimize', browserSync.reload])
            .on('change', function (event) {
                changeEvent(event);
            });
    }

    var options = {
        proxy: 'localhost:' + port,
        port: 3000,
        files: isDev ? [
            config.client + '**/*.*',
            '!' + config.less,
            config.temp + '**/*.css'
        ] : [],
        ghostMode: {
            clicks: true,
            locations: false,
            forms: true,
            scroll: true
        },
        injectChanges: true,
        logFileChanges: true,
        logLevel: 'debug',
        logPrefix: true,
        notify: true,
        reloadDelay: 1000
    };

    browserSync(options);
}

function clean(path, done) {
    log('Cleaning: ' + $.util.colors.blue(path));
    del(path, done);
}

function log(msg) {
    if (typeof (msg) === 'object') {
        for (var item in msg) {
            if (msg.hasOwnProperty(item)) {
                $.util.log($.util.colors.blue(msg[item]));
            }
        }
    } else {
        $.util.log($.util.colors.blue(msg));
    }
}