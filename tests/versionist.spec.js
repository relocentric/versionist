/*
 * Copyright 2016 Resin.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const m = require('mochainon');
const _ = require('lodash');
const childProcess = require('child_process');
const versionist = require('../lib/versionist');

describe('Versionist', function() {

  describe('.readCommitHistory()', function() {

    it('should throw if no gitDirectory', function() {
      m.chai.expect(() => {
        versionist.readCommitHistory(null, {}, _.noop);
      }).to.throw('Missing gitDirectory');
    });

    describe('given childProcess.exec yields an error', function() {

      beforeEach(function() {
        this.error = new Error('foobar');
        this.childProcessExecStub = m.sinon.stub(childProcess, 'exec');
        this.childProcessExecStub.yields(this.error, '', '');
      });

      afterEach(function() {
        this.childProcessExecStub.restore();
      });

      it('should yield back the error', function(done) {
        versionist.readCommitHistory('foo/bar/.git', {}, (error, commits) => {
          m.chai.expect(error).to.equal(this.error);
          m.chai.expect(commits).to.not.exist;
          done();
        });
      });

    });

    describe('given childProcess.exec yields stdout output', function() {

      beforeEach(function() {
        this.childProcessExecStub = m.sinon.stub(childProcess, 'exec');
        this.childProcessExecStub.yields(null, [
          '- subject: >-',
          '    refactor: group AppImage related stuff (#498)',
          '  body: |-',
          '    Currently we had AppImage scripts and other resources in various',
          '    different places in the code base.'
        ].join('\n'), '');
      });

      afterEach(function() {
        this.childProcessExecStub.restore();
      });

      it('should parse stdout as YAML and yield it back', function(done) {
        versionist.readCommitHistory('foo/bar/.git', {}, (error, commits) => {
          m.chai.expect(error).to.not.exist;
          m.chai.expect(commits).to.deep.equal([
            {
              subject: 'refactor: group AppImage related stuff (#498)',
              body: [
                'Currently we had AppImage scripts and other resources in various',
                'different places in the code base.'
              ].join('\n'),
              footer: {}
            }
          ]);

          done();
        });
      });

    });

    describe('given childProcess.exec yields stderr output', function() {

      beforeEach(function() {
        this.childProcessExecStub = m.sinon.stub(childProcess, 'exec');
        this.childProcessExecStub.yields(null, '', 'an error happened');
      });

      afterEach(function() {
        this.childProcessExecStub.restore();
      });

      it('should yield stderr as an error', function(done) {
        versionist.readCommitHistory('foo/bar/.git', {}, (error, commits) => {
          m.chai.expect(error).to.be.an.instanceof(Error);
          m.chai.expect(error.message).to.equal('an error happened');
          m.chai.expect(commits).to.not.exist;
          done();
        });
      });

    });

  });

  describe('.calculateNextVersion()', function() {

    it('should throw if no commits', function() {
      m.chai.expect(() => {
        versionist.calculateNextVersion(null, {
          currentVersion: '1.0.0',
          getIncrementLevelFromCommit: (commit) => {
            return _.first(_.split(commit.subject, ' '));
          }
        });
      }).to.throw('No commits to calculate the next increment level from');
    });

    it('should throw if no options.currentVersion', function() {
      m.chai.expect(() => {
        versionist.calculateNextVersion([
          {
            subject: 'major foo bar'
          }
        ], {
          getIncrementLevelFromCommit: (commit) => {
            return _.first(_.split(commit.subject, ' '));
          }
        });
      }).to.throw('Missing the currentVersion option');
    });

    it('should throw if options.currentVersion is an invalid version', function() {
      m.chai.expect(() => {
        versionist.calculateNextVersion([
          {
            subject: 'major foo bar'
          }
        ], {
          currentVersion: 'hello',
          getIncrementLevelFromCommit: (commit) => {
            return _.first(_.split(commit.subject, ' '));
          }
        });
      }).to.throw('Invalid version: hello');
    });

    it('should throw if options.getIncrementLevelFromCommit is missing', function() {
      m.chai.expect(() => {
        versionist.calculateNextVersion([
          {
            subject: 'major foo bar'
          }
        ], {
          currentVersion: '1.0.0'
        });
      }).to.throw('Missing the getIncrementLevelFromCommit option');
    });

    it('should throw if options.getIncrementLevelFromCommit is not a function', function() {
      m.chai.expect(() => {
        versionist.calculateNextVersion([
          {
            subject: 'major foo bar'
          }
        ], {
          currentVersion: '1.0.0',
          getIncrementLevelFromCommit: 'foo'
        });
      }).to.throw('Invalid getIncrementLevelFromCommit option: foo');
    });

    it('should return options.currentVersion if no increment level was found', function() {
      const version = versionist.calculateNextVersion([
        {
          subject: 'major foo bar'
        },
        {
          subject: 'major foo bar'
        }
      ], {
        currentVersion: '1.0.0',
        getIncrementLevelFromCommit: _.constant(null)
      });

      m.chai.expect(version).to.equal('1.0.0');
    });

    it('should throw if commits is empty', function() {
      m.chai.expect(() => {
        versionist.calculateNextVersion([], {
          currentVersion: '1.0.0',
          getIncrementLevelFromCommit: _.constant(null)
        });
      }).to.throw('No commits to calculate the next increment level from');
    });

  });

  describe('.generateChangelog()', function() {

    it('should throw if no commits', function() {
      m.chai.expect(() => {
        versionist.generateChangelog(null, {
          includeCommitWhen: _.constant(true),
          version: '1.0.0',
          date: new Date(),
          template: 'foo'
        });
      }).to.throw('No commits to generate the CHANGELOG from');
    });

    it('should throw if commits is empty', function() {
      m.chai.expect(() => {
        versionist.generateChangelog([], {
          includeCommitWhen: _.constant(true),
          version: '1.0.0',
          date: new Date(),
          template: 'foo'
        });
      }).to.throw('No commits to generate the CHANGELOG from');
    });

    it('should throw if no version', function() {
      m.chai.expect(() => {
        versionist.generateChangelog([
          {
            subject: 'hello world'
          }
        ], {
          includeCommitWhen: _.constant(true),
          date: new Date(),
          template: 'foo'
        });
      }).to.throw('Missing the version option');
    });

    it('should throw if no template', function() {
      m.chai.expect(() => {
        versionist.generateChangelog([
          {
            subject: 'hello world'
          }
        ], {
          version: '1.0.0',
          date: new Date()
        });
      }).to.throw('Missing the template option');
    });

    it('should throw if date is not an instance of Date', function() {
      m.chai.expect(() => {
        versionist.generateChangelog([
          {
            subject: 'hello world'
          }
        ], {
          version: '1.0.0',
          date: 123,
          template: 'foo'
        });
      }).to.throw('Invalid date option: 123');
    });

    it('should render all commits if no includeCommitWhen', function() {
      const result = versionist.generateChangelog([
        {
          subject: 'foo'
        },
        {
          subject: 'bar'
        },
        {
          subject: 'baz'
        }
      ], {
        version: '1.0.0',
        date: new Date(),
        template: [
          '{{#each commits}}',
          '{{this.subject}}',
          '{{/each}}'
        ].join('\n')
      });

      m.chai.expect(result).to.equal([
        'foo',
        'bar',
        'baz',
        ''
      ].join('\n'));
    });

  });

});