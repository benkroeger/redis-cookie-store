'use strict';

// node core

// third-party

// internal

module.exports = {
  parserOptions: {
    sourceType: 'script',
    ecmaFeatures: {
      jsx: false,
    },
  },
  env: {
    jest: true,
    node: true,
  },
  plugins: ['prettier'],
  extends: ['airbnb-base', 'prettier'],
  rules: {
    'prettier/prettier': 'error',
  },
};
