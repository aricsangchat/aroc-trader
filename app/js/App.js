import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import {
  Route,
  Switch,
  Link,
  withRouter
} from 'react-router-dom';
import history from 'Store/history';
import { CSSTransitionGroup } from 'react-transition-group';
import * as actions from 'Actions/actions';

class App extends React.Component {
  constructor(props) {
    super(props);
  }

  componentWillMount() {

  }

  componentDidMount() {

  }

  componentDidUpdate() {

  }

  render() {
    return (
      <p>hello world</p>
    );
  }
}


App.propTypes = {
};

function mapStateToProps(state) {
  return {
    state: state
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators( actions, dispatch )
  };
}


export default withRouter(connect( mapStateToProps, mapDispatchToProps )(App));
