module.exports = {
    "env": {
        "browser": true,
        "es6": true
    },
    "extends": [
      "airbnb",
      "eslint:recommended",
      "plugin:react/recommended"
    ],
    "parser": "babel-eslint",
    "parserOptions": {
        "ecmaFeatures": {
            "experimentalObjectRestSpread": true,
            "jsx": true
        },
        "sourceType": "module"
    },
    "plugins": [
        "react",
        "json"
    ],
    "rules": {
        "no-debugger":0,
        "no-console":0,
        "import/no-unresolved": 0,
        "import/no-extraneous-dependencies": 0,
        "import/prefer-default-export": 0,
        "import/extensions": 0,
        "react/forbid-prop-types": 0,
        "react/jsx-curly-spacing": [2, "always"],
        "react/jsx-filename-extension": 0,
        "react/no-unused-prop-types": 0,
        "comma-dangle": 0,
        "max-statements": [2, 20],
        "no-unneeded-ternary": 0,
        "no-unused-expressions": 0,
        "no-unused-vars": 0,
        "indent": [
            2,
            2,//number of expected indents
            {"SwitchCase": 1}
        ],
        "linebreak-style": [
            2,
            "unix"
        ],
        "quotes": [
            2,
            "single"
        ],
        "semi": [
            2,
            "always"
        ],
        "no-fallthrough": 1
    }
};
