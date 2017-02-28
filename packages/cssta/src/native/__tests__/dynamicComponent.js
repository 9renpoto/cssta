/* global jest it, expect */
const React = require('react');
const renderer = require('react-test-renderer'); // eslint-disable-line
const dynamicComponent = require('../dynamicComponent');
const VariablesStyleSheetManager = require('../dynamicComponentEnhancers/VariablesStyleSheetManager');
const Transition = require('../dynamicComponentEnhancers/Transition');
const reactNativeMock = require('../__mocks__/react-native');


const runTest = ({
  type = 'button',
  propTypes = [],
  importedVariables = [],
  transitions = [],
  enhancers = [VariablesStyleSheetManager, Transition],
  rules = [],
  inputProps = {},
  expectedType = type,
  expectedProps = {},
  expectedChildren = null,
} = {}) => {
  const args = { rules, importedVariables, transitions };
  const Element = dynamicComponent(type, propTypes, enhancers, args);

  const component = renderer.create(React.createElement(Element, inputProps)).toJSON();

  expect(component.type).toEqual(expectedType);
  expect(component.props).toEqual(expectedProps);
  expect(component.children).toEqual(expectedChildren);
};

it('renders an element', () => runTest());

it('adds a boolean property if it is equal to the expected value', () => runTest({
  propTypes: ['booleanAttribute'],
  rules: [{
    validate: p => !!p.booleanAttribute,
    styleTuples: [['color', 'red']],
    transitions: {},
  }],
  inputProps: { booleanAttribute: true },
  expectedProps: { style: [{ color: 'red' }] },
}));

it('does not add a boolean property if it is not equal to the expected value', () => runTest({
  propTypes: ['booleanAttribute'],
  rules: [{
    validate: p => !!p.booleanAttribute,
    styleTuples: [['color', 'red']],
    transitions: {},
  }],
}));

it('adds a string property if it is equal to the expected value', () => runTest({
  propTypes: ['stringAttribute'],
  rules: [{
    validate: p => p.stringAttribute === 'test',
    styleTuples: [['color', 'red']],
    transitions: {},
  }],
  inputProps: { stringAttribute: 'test' },
  expectedProps: { style: [{ color: 'red' }] },
}));

it('does not add a string property if it is not equal to the expected value', () => runTest({
  propTypes: ['stringAttribute'],
  rules: [{
    validate: p => p.stringAttribute === 'test',
    styleTuples: [['color', 'red']],
    transitions: {},
  }],
}));

it('uses fallback for variable if not defined within scope', () => runTest({
  importedVariables: ['color'],
  rules: [{
    validate: () => true,
    styleTuples: [['color', 'var(--color, red)']],
    transitions: {},
  }],
  expectedProps: { style: [{ color: 'red' }] },
}));

it('converts color-mod functions', () => runTest({
  rules: [{
    validate: () => true,
    styleTuples: [['color', 'color(red tint(50%))']],
    transitions: {},
  }],
  expectedProps: { style: [{ color: 'rgb(255, 128, 128)' }] },
}));

it('transitions values', () => runTest({
  rules: [{
    validate: () => true,
    styleTuples: [['color', 'var(--color, red)']],
    transitions: {
      color: ['1s', 'linear'],
    },
  }],
  transitions: ['color'],
  expectedProps: {
    style: [
      { color: 'red' },
      { color: { isAnimatedValue: true } },
    ],
  },
}));

it('animates between transitioned values', () => {
  const rules = [{
    validate: () => true,
    styleTuples: [['color', 'red']],
    transitions: {
      color: ['1s', 'linear'],
    },
  }, {
    validate: props => props.active,
    styleTuples: [['color', 'blue']],
    transitions: {},
  }];
  const enhancers = [VariablesStyleSheetManager, Transition];
  const args = { rules, importedVariables: [], transitions: ['color'] };
  const Element = dynamicComponent('button', ['active'], enhancers, args);

  const animationStartMock = reactNativeMock.Animated.start;

  animationStartMock.mockClear();
  const instance = renderer.create(React.createElement(Element, {}));

  expect(animationStartMock.mock.calls.length).toBe(0);

  instance.update(React.createElement(Element, { active: true }));

  expect(animationStartMock.mock.calls.length).toBe(1);
});
