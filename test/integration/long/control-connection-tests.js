/**
 * Copyright (C) DataStax, Inc.
 *
 * Please see the license for details:
 * http://www.datastax.com/terms/datastax-dse-driver-license-terms
 */
'use strict';

const assert = require('assert');
const helper = require('../../test-helper');
const utils = require('../../../lib/utils');
const Client = require ('../../../lib/client');

describe('Control Connection', function () {
  this.timeout(240000);
  describe('#init()', function () {
    after(helper.ccmHelper.removeIfAny);
    it('should downgrade to protocol 4 with DSE versions 5.1 & 5.0', function (done) {
      // connect to node running newer version, should detect older version and downgrade to V2.
      const client = new Client(utils.deepExtend({}, helper.baseOptions, {contactPoints: ['127.0.0.2']}));
      const queriedHosts = new Set();
      utils.series([
        helper.ccmHelper.start(1, { version: '5.0.11'}),
        function bootstrap51Node(next) {
          helper.ccmHelper.bootstrapNode(2, next);
        },
        function setdir51Node(next) {
          helper.ccm.exec(['node2', 'setdir', '-v', '5.1.5'], next);
        },
        function start51Node(next) {
          helper.ccmHelper.startNode(2, next);
        },
        function connect(next) {
          client.connect((err) => {
            assert.ifError(err);
            next();
          });
        },
        function query(next) {
          utils.times(10, (n, nNext) => {
            client.execute('select * from system.local', (err, result) => {
              assert.ifError(err);
              queriedHosts.add(result.info.queriedHost);
              nNext();
            });
          }, next);
        },
        function validateQueriedHosts(next) {
          // ensure each host was queried.  If protocol DSE_V1 was in use, we wouldn't be able to query
          // node1.
          assert.strictEqual(queriedHosts.size, 2);
          next();
        }
      ], () => {
        client.shutdown(done);
      });
    });
  });
});
