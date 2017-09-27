import React from 'react';
import {findDOMNode} from 'react-dom';
import PropTypes from 'prop-types';
import Xterm from 'xterm/dist/xterm.js';
import 'xterm/dist/addons/fit/fit.js';
import 'xterm/dist/addons/fullscreen/fullscreen.js';
import io from 'socket.io-client/socket.io.js';

export default class Terminal extends React.Component {
  static propTypes = {
    socketURL: PropTypes.string.isRequired,
    onError: PropTypes.func,
    onClose: PropTypes.func,
    title: PropTypes.string,
    initialEmit: PropTypes.array,
    fullscreen: PropTypes.bool
  }

  constructor(props) {
    super(props);
    this.term = new Xterm({cursorBlink: true});
    this.socket = this.createSocket(props.socketURL);
    this.handleResize = this.handleResize.bind(this);
    this.width = props.width;
    this.height = props.height;
    this.isChange = false;
    this.term.on('data', (data) => {
      this.socket.emit('data', data);
    });
    this.term.on('resize', ({cols, rows}) => {
      this.cols = cols;
      this.rows = rows;
      this.socket.emit('resize', `${cols},${rows}`);
    })
  }

  createSocket(path) {
    const {onError, onClose, initialEmit, title} = this.props;
    const term = this.term;
    const socket = io({path, reconnection: false, forceNew: true});
    this.isChange = false;
    socket.on('connect', () => {
      socket.emit(initialEmit[0], initialEmit[1]);
      term.write(title);
    });
    socket.on('error', (err) => {
      term.write(`\x1b[31mError:${err}\x1b[m\r\n`);
      onError && onError();
    });
    socket.on('disconnect', () => {
      if (!this.isChange) {
        onClose && onClose();
      }
    });
    socket.on('data', (data) => {
      term.write(data);
    });
    return socket;
  }

  close() {
    this.term.destroy();
    this.socket.close();
  }

  handleResize() {
    this.term.fit();
  }

  componentWillMount() {
    const {onClose, socketURL} = this.props;
    if (!socketURL) {
      onClose && onClose();
      this.close();
    }
  }

  componentDidMount() {
    const terminalContainer = findDOMNode(this);
    const {term} = this;
    term.open(terminalContainer);
    this.props.fullscreen && term.toggleFullscreen();
    this.handleResize();
    window.addEventListener('resize', this.handleResize);
  }

  componentWillUnmount() {
    this.close();
    window.removeEventListener('resize', this.handleResize);
  }

  componentWillReceiveProps(nextProps) {
    const {socketURL, width, height} = this.props;
    if (socketURL !== nextProps.socketURL) {
      this.isChange = true;
      this.term.reset();
      this.socket.close();
      this.socket = this.createSocket(nextProps.socketURL);
      this.socket.emit('resize', `${this.cols},${this.rows}`);
      this.term.focus();
    }
  }

  render() {
    return (
      <div id="terminal-container" />
    );
  }
}

Terminal.defaultProps = {
  title: '\x1b[32mWelcome to use cSphere online terminal!\x1b[m\r\n',
  initialEmit: ['auth', 'terminal,50,20'],
  fullscreen: false,
};
