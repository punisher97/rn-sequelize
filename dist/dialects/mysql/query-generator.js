'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

function _possibleConstructorReturn(self, call) { if (call && (typeof call === "object" || typeof call === "function")) { return call; } return _assertThisInitialized(self); }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _get(target, property, receiver) { if (typeof Reflect !== "undefined" && Reflect.get) { _get = Reflect.get; } else { _get = function _get(target, property, receiver) { var base = _superPropBase(target, property); if (!base) return; var desc = Object.getOwnPropertyDescriptor(base, property); if (desc.get) { return desc.get.call(receiver); } return desc.value; }; } return _get(target, property, receiver || target); }

function _superPropBase(object, property) { while (!Object.prototype.hasOwnProperty.call(object, property)) { object = _getPrototypeOf(object); if (object === null) break; } return object; }

function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf(subClass, superClass); }

function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }

const _ = require('lodash');

const Utils = require('../../utils');

const AbstractQueryGenerator = require('../abstract/query-generator');

const util = require('util');

const Op = require('../../operators');

const jsonFunctionRegex = /^\s*((?:[a-z]+_){0,2}jsonb?(?:_[a-z]+){0,2})\([^)]*\)/i;
const jsonOperatorRegex = /^\s*(->>?|@>|<@|\?[|&]?|\|{2}|#-)/i;
const tokenCaptureRegex = /^\s*((?:([`"'])(?:(?!\2).|\2{2})*\2)|[\w\d\s]+|[().,;+-])/i;
const foreignKeyFields = 'CONSTRAINT_NAME as constraint_name,' + 'CONSTRAINT_NAME as constraintName,' + 'CONSTRAINT_SCHEMA as constraintSchema,' + 'CONSTRAINT_SCHEMA as constraintCatalog,' + 'TABLE_NAME as tableName,' + 'TABLE_SCHEMA as tableSchema,' + 'TABLE_SCHEMA as tableCatalog,' + 'COLUMN_NAME as columnName,' + 'REFERENCED_TABLE_SCHEMA as referencedTableSchema,' + 'REFERENCED_TABLE_SCHEMA as referencedTableCatalog,' + 'REFERENCED_TABLE_NAME as referencedTableName,' + 'REFERENCED_COLUMN_NAME as referencedColumnName';
const typeWithoutDefault = new Set(['BLOB', 'TEXT', 'GEOMETRY', 'JSON']);

let MySQLQueryGenerator =
/*#__PURE__*/
function (_AbstractQueryGenerat) {
  _inherits(MySQLQueryGenerator, _AbstractQueryGenerat);

  function MySQLQueryGenerator(options) {
    var _this;

    _classCallCheck(this, MySQLQueryGenerator);

    _this = _possibleConstructorReturn(this, _getPrototypeOf(MySQLQueryGenerator).call(this, options));
    _this.OperatorMap = Object.assign({}, _this.OperatorMap, {
      [Op.regexp]: 'REGEXP',
      [Op.notRegexp]: 'NOT REGEXP'
    });
    return _this;
  }

  _createClass(MySQLQueryGenerator, [{
    key: "createDatabaseQuery",
    value: function createDatabaseQuery(databaseName, options) {
      options = Object.assign({
        charset: null,
        collate: null
      }, options || {});
      const database = this.quoteIdentifier(databaseName);
      const charset = options.charset ? ` DEFAULT CHARACTER SET ${this.escape(options.charset)}` : '';
      const collate = options.collate ? ` DEFAULT COLLATE ${this.escape(options.collate)}` : '';
      return `${`CREATE DATABASE IF NOT EXISTS ${database}${charset}${collate}`.trim()};`;
    }
  }, {
    key: "dropDatabaseQuery",
    value: function dropDatabaseQuery(databaseName) {
      return `DROP DATABASE IF EXISTS ${this.quoteIdentifier(databaseName).trim()};`;
    }
  }, {
    key: "createSchema",
    value: function createSchema() {
      return 'SHOW TABLES';
    }
  }, {
    key: "showSchemasQuery",
    value: function showSchemasQuery() {
      return 'SHOW TABLES';
    }
  }, {
    key: "versionQuery",
    value: function versionQuery() {
      return 'SELECT VERSION() as `version`';
    }
  }, {
    key: "createTableQuery",
    value: function createTableQuery(tableName, attributes, options) {
      options = Object.assign({
        engine: 'InnoDB',
        charset: null,
        rowFormat: null
      }, options || {});
      const primaryKeys = [];
      const foreignKeys = {};
      const attrStr = [];

      for (const attr in attributes) {
        if (!Object.prototype.hasOwnProperty.call(attributes, attr)) continue;
        const dataType = attributes[attr];
        let match;

        if (dataType.includes('PRIMARY KEY')) {
          primaryKeys.push(attr);

          if (dataType.includes('REFERENCES')) {
            // MySQL doesn't support inline REFERENCES declarations: move to the end
            match = dataType.match(/^(.+) (REFERENCES.*)$/);
            attrStr.push(`${this.quoteIdentifier(attr)} ${match[1].replace('PRIMARY KEY', '')}`);
            foreignKeys[attr] = match[2];
          } else {
            attrStr.push(`${this.quoteIdentifier(attr)} ${dataType.replace('PRIMARY KEY', '')}`);
          }
        } else if (dataType.includes('REFERENCES')) {
          // MySQL doesn't support inline REFERENCES declarations: move to the end
          match = dataType.match(/^(.+) (REFERENCES.*)$/);
          attrStr.push(`${this.quoteIdentifier(attr)} ${match[1]}`);
          foreignKeys[attr] = match[2];
        } else {
          attrStr.push(`${this.quoteIdentifier(attr)} ${dataType}`);
        }
      }

      const table = this.quoteTable(tableName);
      let attributesClause = attrStr.join(', ');
      const comment = options.comment && typeof options.comment === 'string' ? ` COMMENT ${this.escape(options.comment)}` : '';
      const engine = options.engine;
      const charset = options.charset ? ` DEFAULT CHARSET=${options.charset}` : '';
      const collation = options.collate ? ` COLLATE ${options.collate}` : '';
      const rowFormat = options.rowFormat ? ` ROW_FORMAT=${options.rowFormat}` : '';
      const initialAutoIncrement = options.initialAutoIncrement ? ` AUTO_INCREMENT=${options.initialAutoIncrement}` : '';
      const pkString = primaryKeys.map(pk => this.quoteIdentifier(pk)).join(', ');

      if (options.uniqueKeys) {
        _.each(options.uniqueKeys, (columns, indexName) => {
          if (columns.customIndex) {
            if (typeof indexName !== 'string') {
              indexName = `uniq_${tableName}_${columns.fields.join('_')}`;
            }

            attributesClause += `, UNIQUE ${this.quoteIdentifier(indexName)} (${columns.fields.map(field => this.quoteIdentifier(field)).join(', ')})`;
          }
        });
      }

      if (pkString.length > 0) {
        attributesClause += `, PRIMARY KEY (${pkString})`;
      }

      for (const fkey in foreignKeys) {
        if (Object.prototype.hasOwnProperty.call(foreignKeys, fkey)) {
          attributesClause += `, FOREIGN KEY (${this.quoteIdentifier(fkey)}) ${foreignKeys[fkey]}`;
        }
      }

      return `CREATE TABLE IF NOT EXISTS ${table} (${attributesClause}) ENGINE=${engine}${comment}${charset}${collation}${initialAutoIncrement}${rowFormat};`;
    }
  }, {
    key: "describeTableQuery",
    value: function describeTableQuery(tableName, schema, schemaDelimiter) {
      const table = this.quoteTable(this.addSchema({
        tableName,
        _schema: schema,
        _schemaDelimiter: schemaDelimiter
      }));
      return `SHOW FULL COLUMNS FROM ${table};`;
    }
  }, {
    key: "showTablesQuery",
    value: function showTablesQuery(database) {
      let query = 'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = \'BASE TABLE\'';

      if (database) {
        query += ` AND TABLE_SCHEMA = ${this.escape(database)}`;
      } else {
        query += ' AND TABLE_SCHEMA NOT IN (\'MYSQL\', \'INFORMATION_SCHEMA\', \'PERFORMANCE_SCHEMA\', \'SYS\')';
      }

      return `${query};`;
    }
  }, {
    key: "addColumnQuery",
    value: function addColumnQuery(table, key, dataType) {
      const definition = this.attributeToSQL(dataType, {
        context: 'addColumn',
        tableName: table,
        foreignKey: key
      });
      return `ALTER TABLE ${this.quoteTable(table)} ADD ${this.quoteIdentifier(key)} ${definition};`;
    }
  }, {
    key: "removeColumnQuery",
    value: function removeColumnQuery(tableName, attributeName) {
      return `ALTER TABLE ${this.quoteTable(tableName)} DROP ${this.quoteIdentifier(attributeName)};`;
    }
  }, {
    key: "changeColumnQuery",
    value: function changeColumnQuery(tableName, attributes) {
      const attrString = [];
      const constraintString = [];

      for (const attributeName in attributes) {
        let definition = attributes[attributeName];

        if (definition.includes('REFERENCES')) {
          const attrName = this.quoteIdentifier(attributeName);
          definition = definition.replace(/.+?(?=REFERENCES)/, '');
          constraintString.push(`FOREIGN KEY (${attrName}) ${definition}`);
        } else {
          attrString.push(`\`${attributeName}\` \`${attributeName}\` ${definition}`);
        }
      }

      let finalQuery = '';

      if (attrString.length) {
        finalQuery += `CHANGE ${attrString.join(', ')}`;
        finalQuery += constraintString.length ? ' ' : '';
      }

      if (constraintString.length) {
        finalQuery += `ADD ${constraintString.join(', ')}`;
      }

      return `ALTER TABLE ${this.quoteTable(tableName)} ${finalQuery};`;
    }
  }, {
    key: "renameColumnQuery",
    value: function renameColumnQuery(tableName, attrBefore, attributes) {
      const attrString = [];

      for (const attrName in attributes) {
        const definition = attributes[attrName];
        attrString.push(`\`${attrBefore}\` \`${attrName}\` ${definition}`);
      }

      return `ALTER TABLE ${this.quoteTable(tableName)} CHANGE ${attrString.join(', ')};`;
    }
  }, {
    key: "handleSequelizeMethod",
    value: function handleSequelizeMethod(smth, tableName, factory, options, prepend) {
      if (smth instanceof Utils.Json) {
        // Parse nested object
        if (smth.conditions) {
          const conditions = this.parseConditionObject(smth.conditions).map(condition => `${this.jsonPathExtractionQuery(condition.path[0], _.tail(condition.path))} = '${condition.value}'`);
          return conditions.join(' AND ');
        }

        if (smth.path) {
          let str; // Allow specifying conditions using the sqlite json functions

          if (this._checkValidJsonStatement(smth.path)) {
            str = smth.path;
          } else {
            // Also support json property accessors
            const paths = _.toPath(smth.path);

            const column = paths.shift();
            str = this.jsonPathExtractionQuery(column, paths);
          }

          if (smth.value) {
            str += util.format(' = %s', this.escape(smth.value));
          }

          return str;
        }
      } else if (smth instanceof Utils.Cast) {
        if (/timestamp/i.test(smth.type)) {
          smth.type = 'datetime';
        } else if (smth.json && /boolean/i.test(smth.type)) {
          // true or false cannot be casted as booleans within a JSON structure
          smth.type = 'char';
        } else if (/double precision/i.test(smth.type) || /boolean/i.test(smth.type) || /integer/i.test(smth.type)) {
          smth.type = 'decimal';
        } else if (/text/i.test(smth.type)) {
          smth.type = 'char';
        }
      }

      return _get(_getPrototypeOf(MySQLQueryGenerator.prototype), "handleSequelizeMethod", this).call(this, smth, tableName, factory, options, prepend);
    }
  }, {
    key: "_toJSONValue",
    value: function _toJSONValue(value) {
      // true/false are stored as strings in mysql
      if (typeof value === 'boolean') {
        return value.toString();
      } // null is stored as a string in mysql


      if (value === null) {
        return 'null';
      }

      return value;
    }
  }, {
    key: "upsertQuery",
    value: function upsertQuery(tableName, insertValues, updateValues, where, model, options) {
      options.onDuplicate = 'UPDATE ';
      options.onDuplicate += Object.keys(updateValues).map(key => {
        key = this.quoteIdentifier(key);
        return `${key}=VALUES(${key})`;
      }).join(', ');
      return this.insertQuery(tableName, insertValues, model.rawAttributes, options);
    }
  }, {
    key: "truncateTableQuery",
    value: function truncateTableQuery(tableName) {
      return `TRUNCATE ${this.quoteTable(tableName)}`;
    }
  }, {
    key: "deleteQuery",
    value: function deleteQuery(tableName, where, options = {}, model) {
      let limit = '';
      let query = `DELETE FROM ${this.quoteTable(tableName)}`;

      if (options.limit) {
        limit = ` LIMIT ${this.escape(options.limit)}`;
      }

      where = this.getWhereConditions(where, null, model, options);

      if (where) {
        query += ` WHERE ${where}`;
      }

      return query + limit;
    }
  }, {
    key: "showIndexesQuery",
    value: function showIndexesQuery(tableName, options) {
      return `SHOW INDEX FROM ${this.quoteTable(tableName)}${(options || {}).database ? ` FROM \`${options.database}\`` : ''}`;
    }
  }, {
    key: "showConstraintsQuery",
    value: function showConstraintsQuery(table, constraintName) {
      const tableName = table.tableName || table;
      const schemaName = table.schema;
      let sql = ['SELECT CONSTRAINT_CATALOG AS constraintCatalog,', 'CONSTRAINT_NAME AS constraintName,', 'CONSTRAINT_SCHEMA AS constraintSchema,', 'CONSTRAINT_TYPE AS constraintType,', 'TABLE_NAME AS tableName,', 'TABLE_SCHEMA AS tableSchema', 'from INFORMATION_SCHEMA.TABLE_CONSTRAINTS', `WHERE table_name='${tableName}'`].join(' ');

      if (constraintName) {
        sql += ` AND constraint_name = '${constraintName}'`;
      }

      if (schemaName) {
        sql += ` AND TABLE_SCHEMA = '${schemaName}'`;
      }

      return `${sql};`;
    }
  }, {
    key: "removeIndexQuery",
    value: function removeIndexQuery(tableName, indexNameOrAttributes) {
      let indexName = indexNameOrAttributes;

      if (typeof indexName !== 'string') {
        indexName = Utils.underscore(`${tableName}_${indexNameOrAttributes.join('_')}`);
      }

      return `DROP INDEX ${this.quoteIdentifier(indexName)} ON ${this.quoteTable(tableName)}`;
    }
  }, {
    key: "attributeToSQL",
    value: function attributeToSQL(attribute, options) {
      if (!_.isPlainObject(attribute)) {
        attribute = {
          type: attribute
        };
      }

      const attributeString = attribute.type.toString({
        escape: this.escape.bind(this)
      });
      let template = attributeString;

      if (attribute.allowNull === false) {
        template += ' NOT NULL';
      }

      if (attribute.autoIncrement) {
        template += ' auto_increment';
      } // BLOB/TEXT/GEOMETRY/JSON cannot have a default value


      if (!typeWithoutDefault.has(attributeString) && attribute.type._binary !== true && Utils.defaultValueSchemable(attribute.defaultValue)) {
        template += ` DEFAULT ${this.escape(attribute.defaultValue)}`;
      }

      if (attribute.unique === true) {
        template += ' UNIQUE';
      }

      if (attribute.primaryKey) {
        template += ' PRIMARY KEY';
      }

      if (attribute.comment) {
        template += ` COMMENT ${this.escape(attribute.comment)}`;
      }

      if (attribute.first) {
        template += ' FIRST';
      }

      if (attribute.after) {
        template += ` AFTER ${this.quoteIdentifier(attribute.after)}`;
      }

      if (attribute.references) {
        if (options && options.context === 'addColumn' && options.foreignKey) {
          const attrName = this.quoteIdentifier(options.foreignKey);
          const fkName = this.quoteIdentifier(`${options.tableName}_${attrName}_foreign_idx`);
          template += `, ADD CONSTRAINT ${fkName} FOREIGN KEY (${attrName})`;
        }

        template += ` REFERENCES ${this.quoteTable(attribute.references.model)}`;

        if (attribute.references.key) {
          template += ` (${this.quoteIdentifier(attribute.references.key)})`;
        } else {
          template += ` (${this.quoteIdentifier('id')})`;
        }

        if (attribute.onDelete) {
          template += ` ON DELETE ${attribute.onDelete.toUpperCase()}`;
        }

        if (attribute.onUpdate) {
          template += ` ON UPDATE ${attribute.onUpdate.toUpperCase()}`;
        }
      }

      return template;
    }
  }, {
    key: "attributesToSQL",
    value: function attributesToSQL(attributes, options) {
      const result = {};

      for (const key in attributes) {
        const attribute = attributes[key];
        result[attribute.field || key] = this.attributeToSQL(attribute, options);
      }

      return result;
    }
    /**
     * Check whether the statmement is json function or simple path
     *
     * @param   {string}  stmt  The statement to validate
     * @returns {boolean}       true if the given statement is json function
     * @throws  {Error}         throw if the statement looks like json function but has invalid token
     * @private
     */

  }, {
    key: "_checkValidJsonStatement",
    value: function _checkValidJsonStatement(stmt) {
      if (typeof stmt !== 'string') {
        return false;
      }

      let currentIndex = 0;
      let openingBrackets = 0;
      let closingBrackets = 0;
      let hasJsonFunction = false;
      let hasInvalidToken = false;

      while (currentIndex < stmt.length) {
        const string = stmt.substr(currentIndex);
        const functionMatches = jsonFunctionRegex.exec(string);

        if (functionMatches) {
          currentIndex += functionMatches[0].indexOf('(');
          hasJsonFunction = true;
          continue;
        }

        const operatorMatches = jsonOperatorRegex.exec(string);

        if (operatorMatches) {
          currentIndex += operatorMatches[0].length;
          hasJsonFunction = true;
          continue;
        }

        const tokenMatches = tokenCaptureRegex.exec(string);

        if (tokenMatches) {
          const capturedToken = tokenMatches[1];

          if (capturedToken === '(') {
            openingBrackets++;
          } else if (capturedToken === ')') {
            closingBrackets++;
          } else if (capturedToken === ';') {
            hasInvalidToken = true;
            break;
          }

          currentIndex += tokenMatches[0].length;
          continue;
        }

        break;
      } // Check invalid json statement


      if (hasJsonFunction && (hasInvalidToken || openingBrackets !== closingBrackets)) {
        throw new Error(`Invalid json statement: ${stmt}`);
      } // return true if the statement has valid json function


      return hasJsonFunction;
    }
    /**
     * Generates an SQL query that returns all foreign keys of a table.
     *
     * @param  {Object} table  The table.
     * @param  {string} schemaName The name of the schema.
     * @returns {string}            The generated sql query.
     * @private
     */

  }, {
    key: "getForeignKeysQuery",
    value: function getForeignKeysQuery(table, schemaName) {
      const tableName = table.tableName || table;
      return `SELECT ${foreignKeyFields} FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE where TABLE_NAME = '${tableName}' AND CONSTRAINT_NAME!='PRIMARY' AND CONSTRAINT_SCHEMA='${schemaName}' AND REFERENCED_TABLE_NAME IS NOT NULL;`;
    }
    /**
     * Generates an SQL query that returns the foreign key constraint of a given column.
     *
     * @param  {Object} table  The table.
     * @param  {string} columnName The name of the column.
     * @returns {string}            The generated sql query.
     * @private
     */

  }, {
    key: "getForeignKeyQuery",
    value: function getForeignKeyQuery(table, columnName) {
      const quotedSchemaName = table.schema ? wrapSingleQuote(table.schema) : '';
      const quotedTableName = wrapSingleQuote(table.tableName || table);
      const quotedColumnName = wrapSingleQuote(columnName);
      return `SELECT ${foreignKeyFields} FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE` + ` WHERE (REFERENCED_TABLE_NAME = ${quotedTableName}${table.schema ? ` AND REFERENCED_TABLE_SCHEMA = ${quotedSchemaName}` : ''} AND REFERENCED_COLUMN_NAME = ${quotedColumnName})` + ` OR (TABLE_NAME = ${quotedTableName}${table.schema ? ` AND TABLE_SCHEMA = ${quotedSchemaName}` : ''} AND COLUMN_NAME = ${quotedColumnName} AND REFERENCED_TABLE_NAME IS NOT NULL)`;
    }
    /**
     * Generates an SQL query that removes a foreign key from a table.
     *
     * @param  {string} tableName  The name of the table.
     * @param  {string} foreignKey The name of the foreign key constraint.
     * @returns {string}            The generated sql query.
     * @private
     */

  }, {
    key: "dropForeignKeyQuery",
    value: function dropForeignKeyQuery(tableName, foreignKey) {
      return `ALTER TABLE ${this.quoteTable(tableName)}
      DROP FOREIGN KEY ${this.quoteIdentifier(foreignKey)};`;
    }
  }]);

  return MySQLQueryGenerator;
}(AbstractQueryGenerator); // private methods


function wrapSingleQuote(identifier) {
  return Utils.addTicks(identifier, '\'');
}

module.exports = MySQLQueryGenerator;