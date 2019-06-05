module.exports = {
    extends: ['eslint-config-airbnb-base'],
    rules: {
        'indent': ["error", 4],
        'linebreak-style': 'off',
        'no-underscore-dangle': 'off',
        'implicit-arrow-linebreak': 'off',
        'import/extensions': 'off',
        'import/prefer-default-export': 'off',
        'import/no-absolute-path': 'off',
        'import/no-unresolved': 'off',
        'import/no-extraneous-dependencies': [
            'error',
            {
                devDependencies: ['**/*.spec.js'],
            },
        ],
        'class-methods-use-this': [
            'error',
            {
                exceptMethods: [
                    // web components life cycle
                    'connectedCallback',
                    'disconnectedCallback',

                    // LitElement life cycle
                    'performUpdate',
                    'shouldUpdate',
                    'firstUpdated',
                    'update',
                    'updated',
                    'createRenderRoot',
                    'render',
                ],
            },
        ]
    },
    overrides: [
        {
            files: ['**/*.spec.js'],
            rules: {
                'no-console': 'off',
                'no-unused-expressions': 'off',
                'class-methods-use-this': 'off',
            },
        },
    ],
    'globals': {
        "expect": "readonly",
    },
    parser: 'babel-eslint',
    parserOptions: {
        sourceType: 'module',
        allowImportExportEverywhere: true
    },
    "env": {
        "browser": true,
        "node": true,
        "mocha": true
    }
};
