'use strict';

var assert = require('assert');
var after = require('after');
var enRoute = require('..');
var Router = enRoute.Router;

describe('methods', function() {
  it('should return a Router with specific methods', function() {
    var options = {
      methods: ['before', 'after']
    };
    var router = new Router(options);
    assert.equal(typeof router, 'function');
    assert.equal(typeof router.all, 'function');
    assert.equal(typeof router.before, 'function');
    assert.equal(typeof router.after, 'function');
  });

  it('should return a Router with specific original methods then allow adding additional methods', function() {
    var options = {
      methods: ['before', 'after']
    };

    var router = new Router(options);
    assert.equal(typeof router, 'function');
    assert.equal(typeof router.all, 'function');
    assert.equal(typeof router.before, 'function');
    assert.equal(typeof router.after, 'function');
    assert.equal(typeof router.additional, 'undefined');

    router.method('additional');
    assert.equal(typeof router.additional, 'function');
  });

  it('should support dynamic routes on methods', function(cb) {
    var router = new Router({
      methods: ['before']
    });
    var another = new Router({
      methods: ['before']
    });

    another.before('/:bar', function(file, next) {
      assert(file.options.params.bar, 'route');
      next();
    });
    router.use('/:foo', another);

    router.handle({
      path: '/test/route',
      options: {
        method: 'before'
      }
    }, cb);
  });

  describe('.handle', function() {
    it('should dispatch to methods', function(cb) {
      var router = new Router({
        methods: ['before']
      });
      var file = {
        path: '/foo',
        options: {
          method: 'before'
        }
      };

      router.route('/foo').before(function(file, next) {
        file.content = 'foo';
        next();
      });

      router.handle(file, function(err) {
        if (err) return cb(err);

        assert(file.content, 'foo');
        cb();
      });
    });

    it('should dispatch to dynamic methods', function(cb) {
      var router = new Router({
        methods: ['before']
      });
      router.method('additional');
      var file = {
        path: '/foo',
        options: {
          method: 'additional'
        }
      };

      router.route('/foo').additional(function(file, next) {
        file.content = 'foo';
        next();
      });

      router.handle(file, function(err) {
        if (err) return cb(err);
        assert(file.content, 'foo');
        cb();
      });
    });
  });

  describe('.multiple callbacks', function() {
    it('should throw if a callback is null on a method', function() {
      assert.throws(function() {
        var router = new Router({
          methods: ['before']
        });
        router.route('/foo').before(null);
      });
    });

    it('should throw if a callback is undefined on a method', function() {
      assert.throws(function() {
        var router = new Router({
          methods: ['before']
        });
        router.route('/foo').before(undefined);
      });
    });

    it('should throw if a callback is not a function on a method', function() {
      assert.throws(function() {
        var router = new Router({
          methods: ['before']
        });
        router.route('/foo').before('not a function');
      });
    });

    it('should not throw if all callbacks are functions on a method', function() {
      var router = new Router({
        methods: ['before']
      });
      router.route('/foo').before(function(file, next) {
        next();
      }).all(function(file, next) {
        next();
      });
    });
  });

  describe('error', function() {
    it('should skip non error middleware on a method', function(cb) {
      var router = new Router({
        methods: ['before']
      });

      router.before('/foo', function(file, next) {
        next(new Error('foo'));
      });

      router.before('/bar', function(file, next) {
        next(new Error('bar'));
      });

      router.use(function(file, next) {
        assert(false);
      });

      router.handle({
        path: '/foo',
        options: {
          method: 'before'
        }
      }, function(err) {
        assert.equal(err.message, 'foo');
        cb();
      });
    });

    it('should handle throwing inside routes with params on a method', function(cb) {
      var router = new Router({
        methods: ['before']
      });

      router.before('/foo/:id', function(file, next) {
        throw new Error('foo');
      });

      router.use(function(file, next) {
        assert(false);
      });

      router.handle({
        path: '/foo/2',
        options: {
          method: 'before'
        }
      }, function(err) {
        assert.equal(err.message, 'foo');
        cb();
      });
    });
  });

  describe('.param', function() {
    it('should call param function when routing on a method', function(cb) {
      var called = [];
      var file = {path: '/foo/123/bar', options: {method: 'before'}};
      var router = new Router({methods: ['before']});

      router.param('id', function(file, next, id) {
        assert.equal(id, '123');
        called.push('param');
        next();
      });

      router.before('/foo/:id/bar', function(file, next) {
        assert.equal(file.options.params.id, '123');
        called.push('before');
        next();
      });

      router.handle(file, function(err) {
        if (err) {
          cb(err);
          return
        }

        assert(called.indexOf('before') !== -1);
        assert(called.indexOf('before') !== -1);
        cb();
      });
    });

    it('should only call once per request on a method', function(cb) {
      var count = 0;

      var file = {path: '/foo/bob/bar', options: {method: 'before'}};
      var router = new Router({methods: ['before']});
      var sub = new Router({methods: ['before']});

      sub.before('/bar', function(file, next) {
        next();
      });

      router.param('user', function(file, next, user) {
        count++;
        file.user = user;
        next();
      });

      router.use('/foo/:user/', new Router());
      router.use('/foo/:user/', sub);

      router.handle(file, function(err) {
        if (err) return cb(err);
        assert.equal(count, 1);
        assert.equal(file.user, 'bob');
        cb();
      });
    });

    it('should call when values differ on a method', function(cb) {
      var count = 0;
      var file = {
        path: '/foo/bob/bar',
        options: {
          method: 'before'
        }
      };
      var router = new Router({
        methods: ['before']
      });
      var sub = new Router({
        methods: ['before']
      });

      sub.before('/bar', function(file, next) {
        next();
      });

      router.param('user', function(file, next, user) {
        count++;
        file.user = user;
        next();
      });

      router.use('/foo/:user/', new Router());
      router.use('/:user/bob/', sub);

      router.handle(file, function(err) {
        if (err) return cb(err);
        assert.equal(count, 2);
        assert.equal(file.user, 'foo');
        cb();
      });
    });
  });

  describe('parallel calls', function() {
    it('should not mix calls on a method', function(cb) {
      var file1 = {
        path: '/foo/50/bar',
        options: {
          method: 'before'
        }
      };
      var file2 = {
        path: '/foo/10/bar',
        options: {
          method: 'before'
        }
      };
      var router = new Router({
        methods: ['before']
      });
      var sub = new Router({
        methods: ['before']
      });

      cb = after(2, cb);

      sub.before('/bar', function(file, next) {
        next();
      });

      router.param('ms', function(file, next, ms) {
        ms = parseInt(ms, 10);
        file.ms = ms;
        setTimeout(next, ms);
      });

      router.use('/foo/:ms/', new Router());
      router.use('/foo/:ms/', sub);

      router.handle(file1, function(err) {
        assert.ifError(err);
        assert.equal(file1.ms, 50);
        assert.equal(file1.options.originalPath, '/foo/50/bar');
        cb();
      });

      router.handle(file2, function(err) {
        assert.ifError(err);
        assert.equal(file2.ms, 10);
        assert.equal(file2.options.originalPath, '/foo/10/bar');
        cb();
      });
    });
  });
});
