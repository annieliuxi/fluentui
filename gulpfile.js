'use strict';

let build = require('web-library-build');
let gulp = require('gulp');
let configFile = "./ftpconfig.json";
let fs = require('fs');

/** @todo: disable lint config. */
build.tslint.setConfig({ lintConfig: require('./tslint.json') });


build.postCopy.setConfig({
  copyTo: {
    'dist': [ 'src/**/*.png' ]
  }
});

// process *.Example.tsx as text.
build.text.setConfig({ textMatch: ['src/**/*.txt', 'src/**/*.Example.tsx', 'src/**/*.Props.ts'] });

let isProduction = process.argv.indexOf( '--production' ) >= 0;
let isNuke = process.argv.indexOf( 'nuke' ) >= 0;

if (isProduction || isNuke) {
  build.setConfig({
    libAMDFolder: 'lib-amd'
  });
}

gulp.task('install-deploy', function(cb) {
  let prompt = require('gulp-prompt');

  gulp.src('index.html') 
    .pipe(prompt.prompt([{
        type: 'input',
        name: 'host',
        message: 'Please enter hostname'
    },
    {
        type: 'input',
        name: 'user',
        message: 'Please enter username'
    },
    {
        type: 'input',
        name: 'password',
        message: 'Please enter password'
    },
    {
        type: 'input',
        name: 'deployurl',
        message: 'Enter deploy URL'
    },
    {
        type: 'input',
        name: 'deploybasepath',
        message: 'Please deployment base path'
    }], function(res) {
        let ftpdata = {
          "host": res.host,
          "user": res.user,
          "password": res.password,
          "deployurl": res.deployurl,
          "deploybasepath": res.deploybasepath
        };
        fs.writeFileSync(configFile, JSON.stringify(ftpdata));
        cb();
    }));
});

gulp.task('deploy', ['bundle'],  function(cb) {
  let ftp = require('vinyl-ftp');
  let git = require('git-rev');
  let debug = require('gulp-debug');
  let gutil = require('gulp-util');
  let os = require('os');
  let currentBranch;
  let json;
  let data;
  let uploadPath;

  try {
    json = fs.readFileSync(configFile, 'utf8');
    data = JSON.parse(json);

    git.branch(function(branch) {
      currentBranch = os.hostname().split('.')[0] + '-' + branch.replace('/', '-');
      let ftpConnection = ftp.create({
        host: data.host,
        user: data.user,
        pass: data.password,
        parallel: 10,
        secure: true,
        idleTimeout: 10000
      });
      let globs = [
        './index.html',
        './dist/**/*'
      ];
      if (process.env.masterBuildLink || isProduction) {
        currentBranch = 'master';
      }

      let uploadPath = data.deploybasepath + currentBranch;
      let stream = gulp.src( globs, { base: '.', buffer: false })
        .pipe(debug({ title: 'Copying file to server' }))
        .pipe(ftpConnection.dest(uploadPath))
        .on('error', function(er) {
          console.log(er);
        })
        .on("end", function() {
          gutil.log( data.deployurl + currentBranch + '/' );
          cb();
        });
    });
  }
  catch(err) {
    gutil.log("Please run gulp install-deploy before deploying");
  }
});

/** @todo: Enable css modules when ready. */
// build.sass.setConfig({ useCSSModules: true });

build.task('tslint', build.tslint);

// initialize tasks.
build.initialize(gulp);
