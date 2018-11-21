import React, { Component, isValidElement, cloneElement } from "react";
import PropTypes from "prop-types";
import ResizeObserver from "resize-observer-polyfill";
import debounce from "lodash.debounce";
import throttle from "lodash.throttle";
import isFunction from "lodash.isfunction";

const listMode = { debounce, throttle };

const styles = {
  position: "absolute",
  width: 0,
  height: 0,
  visibility: "hidden",
  display: "none"
};

/**
 * detect component's children and convert them to array
 * @param {*} children - component's children
 */
function convertChildrenToArray(children) {
  if (!children) return [];
  if (!Array.isArray(children)) return [children];
  return children;
}

class ResizeDetector extends Component {
  constructor(props) {
    super(props);

    const { skipOnMount, refreshMode, refreshRate } = props;

    this.state = {
      width: undefined,
      height: undefined
    };

    this.skipOnMount = skipOnMount;
    this.animationFrameID = null;

    this.resizeHandler =
      (listMode[refreshMode] &&
        listMode[refreshMode](this.createResizeHandler, refreshRate)) ||
      this.createResizeHandler;

    this.ro = new ResizeObserver(this.resizeHandler);
  }

  componentDidMount() {
    const resizableElement = this.getElement();
    if (resizableElement) this.ro.observe(resizableElement);
  }

  componentWillUnmount() {
    const resizableElement = this.getElement();
    if (resizableElement) this.ro.unobserve(resizableElement);
    if (typeof window !== "undefined" && this.animationFrameID) {
      window.cancelAnimationFrame(this.animationFrameID);
    }
    if (this.resizeHandler && this.resizeHandler.cancel) {
      // cancel debounced handler
      this.resizeHandler.cancel();
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    return nextProps !== this.props || nextState !== this.state;
  }

  getElement = () => {
    const { resizableElementId } = this.props;

    const otherElement =
      resizableElementId && document.getElementById(resizableElementId);
    const parentElement = this.el && this.el.parentElement;

    const resizableElement = otherElement || parentElement;

    return resizableElement;
  };

  createResizeHandler = entries => {
    const { handleWidth, handleHeight, onResize } = this.props;
    entries.forEach(entry => {
      const { width, height } = entry.contentRect;
      const notifyWidth = handleWidth && this.state.width !== width;
      const notifyHeight = handleHeight && this.state.height !== height;
      if (
        !this.skipOnMount &&
        (notifyWidth || notifyHeight) &&
        typeof window !== "undefined"
      ) {
        this.animationFrameID = window.requestAnimationFrame(() => {
          onResize(width, height);
          this.setState({ width, height });
        });
      }
      this.skipOnMount = false;
    });
  };

  handleRenderProp = () => {
    const { width, height } = this.state;
    const { render } = this.props;
    if (render && typeof render === "function") {
      return cloneElement(render({ width, height }), { key: "render" });
    }

    return undefined;
  };

  renderChildren = () => {
    const { width, height } = this.state;
    const { children } = this.props;
    return convertChildrenToArray(children)
      .filter(child => !!child)
      .map((child, key) => {
        if (isFunction(child))
          return cloneElement(child(width, height), { key });
        if (isValidElement(child))
          return cloneElement(child, { width, height, key });
        return child;
      });
  };

  render() {
    return (
      <div>
        {[
          <div
            key="resize-detector"
            style={styles}
            ref={el => {
              this.el = el;
            }}
          />,
          this.handleRenderProp(),
          ...this.renderChildren()
        ]}
      </div>
    );
  }
}

ResizeDetector.propTypes = {
  handleWidth: PropTypes.bool,
  handleHeight: PropTypes.bool,
  skipOnMount: PropTypes.bool,
  refreshRate: PropTypes.number,
  refreshMode: PropTypes.string,
  resizableElementId: PropTypes.string,
  onResize: PropTypes.func,
  render: PropTypes.func,
  children: PropTypes.any // eslint-disable-line react/forbid-prop-types
};

ResizeDetector.defaultProps = {
  handleWidth: false,
  handleHeight: false,
  skipOnMount: false,
  refreshRate: 1000,
  refreshMode: undefined,
  resizableElementId: "",
  onResize: e => e,
  render: undefined,
  children: null
};

export const withResizeDetector = (
  WrappedComponent,
  props = { handleWidth: true, handleHeight: true }
) =>
  // eslint-disable-next-line
  class ResizeDetectorHOC extends Component {
    render() {
      return (
        <ResizeDetector {...props}>
          <WrappedComponent {...this.props} />
        </ResizeDetector>
      );
    }
  };

export default ResizeDetector;
