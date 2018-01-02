import 'babel-polyfill';
import React from 'react';
import { render } from 'react-dom';
import { Provider } from 'react-redux';
import configureStore from 'Store/configureStore';
import '../style/scss/style.scss'; // eslint-disable-line
import App from './App';
import {
  BrowserRouter
} from 'react-router-dom';

const store = configureStore();

render(
  <Provider store={ store }>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </Provider>,
  document.getElementById('app')
);
