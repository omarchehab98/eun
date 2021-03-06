'use strict'
const EventEmitter = require('events')
const mongoose = require('mongoose')
mongoose.Promise = global.Promise

const defaultTo = require('lodash/defaultTo')
const isObject = require('lodash/isObject')

var Expense = require('./models/expense.js')
var Income = require('./models/income.js')

class Expenses extends EventEmitter {
  /**
   * Connects to a MongoDB database using the specified credentials and options.
   * @param  {Object} credentials
   * @param  {string} credentials.host
   * @param  {string} credentials.database
   * @param  {string} [credentials.username]
   * @param  {string} [credentials.password]
   * @param  {number} [credentials.port]
   * @param  {number} [credentials.authSource]
   * @param  {Object} [options]
   * @param  {boolean} [options.connectOnInit]
   * @param  {Object} [dependencies]
   * @see {@link https://github.com/Automattic/mongoose|mongoose}
   * @param  {Function} [dependencies.mongoose]
   */
  constructor (credentials, options, dependencies) {
    super()

    this._credentials = {
      host: credentials.host,
      database: credentials.database,
      username: defaultTo(credentials.username, null),
      password: defaultTo(credentials.password, null),
      authSource: defaultTo(credentials.authSource, null),
      port: defaultTo(credentials.port, 27017)
    }

    options = defaultTo(options, {})

    this._options = {
      connectOnInit: defaultTo(options.connectOnInit, true)
    }

    dependencies = defaultTo(dependencies, {})

    this._dependencies = {
      mongoose: defaultTo(dependencies.mongoose, mongoose)
    }

    if (this._options.connectOnInit) {
      this.connect()
    }
  }

  /**
   * Attempts to connect to the mongo database using the credentials.
   * On success, 'connect' will be emitted.
   * In the event of any error, 'error' will be emitted.
   * Does nothing if it is already connected.
   */
  connect () {
    if (this.isConnected) {
      return
    }

    const host = this._credentials.host
    const port = this._credentials.port
    const database = this._credentials.database
    let uri

    const hasUsername = this._credentials.username !== null
    const hasPassword = this._credentials.password !== null
    const hasAuthSource = this._credentials.authSource !== null
    if (hasUsername && hasPassword && hasAuthSource) {
      const username = this._credentials.username
      const password = this._credentials.password
      const authSource = this._credentials.authSource
      uri = `mongodb://${username}:${password}@${host}:${port}/${database}?authSource=${authSource}`
    } else {
      uri = `mongodb://${host}:${port}/${database}`
    }

    this._db = this._dependencies.mongoose.createConnection(uri)

    Expense = Expense(this._dependencies.mongoose, this._db)
    Income = Income(this._dependencies.mongoose, this._db)

    this._db.on('open', this._onConnect.bind(this))
    this._db.on('error', this._onError.bind(this))
  }

  /**
   * Disconnects from the mongo database and emits the 'disconnect' event.
   * Does nothing if it is already disconnected.
   */
  disconnect () {
    if (!this.isConnected) {
      return
    }

    this._db.close()
    this._onDisconnect()
  }

  /**
   * Returns whether or not there is a connection with the mongo database.
   * @return {Boolean}
   */
  get isConnected () {
    const dbIsDefined = isObject(this._db)
    const CONNECTED = 1
    return dbIsDefined && this._db.readyState === CONNECTED
  }

  /**
   * Inserts an expense entry into the mongo database.
   * Requires `e` to follow the Expense model interface.
   * @param  {Object} e
   */
  putExpense (e) {
    const expense = new Expense(e)
    expense.save()
  }

  /**
   * Returns a promise that resolves with all of the expense entries between
   * `s` (inclusive) and `e` (exclusive).
   * Promise is rejected if there is an error.
   * @param {number}  s  lower bound, unix timestamp in seconds
   * @param {number}  e  upper bound, unix timestamp in seconds
   * @return {Promise}  resolves with Expense[]
   */
  getExpenses (s, e) {
    return new Promise((resolve, reject) => {
      Expense.find({
        timestamp: {
          $gte: s,
          $lt: e
        }
      }, [
        '_id',
        'account',
        'amount',
        'currency',
        'timestamp',
        'description',
        'availableCredit',
        'category'
      ], {
        sort: {
          timestamp: -1
        }
      }, (error, expenses) => {
        if (error) {
          reject(error)
        } else {
          resolve(expenses)
        }
      })
    })
  }

  /**
   * Removes a specific expense entry given an `id`.
   *
   * Returns a promise that resolves if the entry is deleted and rejects
   * if no deletion took place.
   * @param {string} id
   * @return {Promise}
   */
  removeExpense (id) {
    return new Promise((resolve, reject) => {
      Expense.remove({
        _id: id
      }, (error) => {
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      })
    })
  }

  /**
   * Edits a specific expense entry given an `id`.
   *
   * Returns a promise that resolves if the entry is editted and rejects
   * if no edit took place.
   * @param {string} id
   * @param {Object} changes
   * @param {string} changes.description
   * @param {number} changes.timestamp
   * @param {string} changes.category
   * @return {Promise}
   */
  editExpense (id, changes) {
    return new Promise((resolve, reject) => {
      Expense.update({
        _id: id
      }, {
        description: changes.description,
        timestamp: changes.timestamp,
        category: changes.category
      }, (error) => {
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      })
    })
  }

  /**
   * Inserts an income entry into the mongo database.
   * Requires `i` to follow the Income model interface.
   * @param  {Object} i
   */
  putIncome (i) {
    const income = new Income(i)
    income.save()
  }

  /**
   * Returns a promise that resolves with all of the income entries between
   * `s` (inclusive) and `e` (exclusive).
   * Promise is rejected if there is an error.
   * @param {number}  s  lower bound, unix timestamp in seconds
   * @param {number}  e  upper bound, unix timestamp in seconds
   * @return {Promise}  resolves with Income[]
   */
  getIncome (s, e) {
    return new Promise((resolve, reject) => {
      Income.find({
        timestamp: {
          $gte: s,
          $lt: e
        }
      }, [
        '_id',
        'account',
        'amount',
        'currency',
        'timestamp',
        'description',
        'availableCredit',
        'category'
      ], {
        sort: {
          timestamp: -1
        }
      }, (error, expenses) => {
        if (error) {
          reject(error)
        } else {
          resolve(expenses)
        }
      })
    })
  }

  /**
   * Removes a specific income entry given an `id`.
   *
   * Returns a promise that resolves if the entry is deleted and rejects
   * if no deletion took place.
   * @param {string} id
   * @return {Promise}
   */
  removeIncome (id) {
    return new Promise((resolve, reject) => {
      Income.remove({
        _id: id
      }, (error) => {
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      })
    })
  }

  /**
   * Edits a specific income entry given an `id`.
   *
   * Returns a promise that resolves if the entry is editted and rejects
   * if no edit took place.
   * @param {string} id
   * @param {Object} changes
   * @param {string} changes.description
   * @param {number} changes.timestamp
   * @param {string} changes.category
   * @return {Promise}
   */
  editIncome (id, changes) {
    return new Promise((resolve, reject) => {
      Income.update({
        _id: id
      }, {
        description: changes.description,
        timestamp: changes.timestamp,
        category: changes.category
      }, (error) => {
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      })
    })
  }

  /**
   * Emits the 'connect' event.
   */
  _onConnect () {
    this.emit('connect')
  }

  /**
   * Emits the 'disconnect' event.
   */
  _onDisconnect () {
    this.emit('disconnect')
  }

  /**
   * Emits the 'error' event with an Error.
   * @param  {(Error|string)} error
   */
  _onError (error) {
    if (!(error instanceof Error)) {
      error = new Error(error)
    }

    this.emit('error', error)
  }
}

module.exports = Expenses
