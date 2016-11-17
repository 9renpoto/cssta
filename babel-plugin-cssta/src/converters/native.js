/* eslint-disable no-param-reassign */
const t = require('babel-types');
const _ = require('lodash/fp');
const { createValidatorNodeForSelector } = require('cssta/src/native/selectorTransform');
const getRoot = require('cssta/src/util/getRoot');
const {
  default: cssToReactNative, getPropertyName,
} = require('css-to-react-native');
const { getOrCreateImportReference, jsonToNode } = require('../util');

const SIMPLE_OR_NO_INTERPOLATION = 0;
const ADVANCED_INTERPOLATION = 1;

const convertValue = transform => value => t.callExpression(t.identifier(transform), [value]);

const stringInterpolation = value =>
  t.callExpression(t.memberExpression(convertValue('String')(value), t.identifier('trim')), []);

const numberInterpolation = convertValue('Number');

/*
All the values we can work out easily.

E.g.
fontSize: ${value} can only be a number -> { fontSize: Number(value) }
position: ${value} can only be a string -> { position: String(value).trim() }

Some values, like 'margin', have shorthands, so cannot be included.
*/
const simpleInterpolation = {
  /* View */
  backfaceVisibility: stringInterpolation,
  background: stringInterpolation,
  backgroundColor: stringInterpolation,
  borderBottomColor: stringInterpolation,
  borderBottomLeftRadius: numberInterpolation,
  borderBottomRightRadius: numberInterpolation,
  borderBottomWidth: numberInterpolation,
  borderLeftColor: stringInterpolation,
  borderLeftWidth: numberInterpolation,
  borderRightColor: stringInterpolation,
  borderRightWidth: numberInterpolation,
  borderTopColor: stringInterpolation,
  borderTopLeftRadius: numberInterpolation,
  borderTopRightRadius: numberInterpolation,
  borderTopWidth: numberInterpolation,
  opacity: numberInterpolation,
  elevation: numberInterpolation,
  /* Layout */
  alignItems: stringInterpolation,
  alignSelf: stringInterpolation,
  bottom: numberInterpolation,
  flexBasis: numberInterpolation,
  flexDirection: stringInterpolation,
  flexGrow: numberInterpolation,
  flexShrink: numberInterpolation,
  flexWrap: stringInterpolation,
  height: numberInterpolation,
  justifyContent: stringInterpolation,
  left: numberInterpolation,
  marginBottomWidth: numberInterpolation,
  marginLeftWidth: numberInterpolation,
  marginRightWidth: numberInterpolation,
  marginTopWidth: numberInterpolation,
  maxHeight: numberInterpolation,
  maxWidth: numberInterpolation,
  minHeight: numberInterpolation,
  minWidth: numberInterpolation,
  overflow: stringInterpolation,
  paddingBottomWidth: numberInterpolation,
  paddingLeftWidth: numberInterpolation,
  paddingRightWidth: numberInterpolation,
  paddingTopWidth: numberInterpolation,
  position: stringInterpolation,
  right: numberInterpolation,
  top: numberInterpolation,
  width: numberInterpolation,
  zIndex: numberInterpolation,
  /* Text */
  color: stringInterpolation,
  fontFamily: stringInterpolation, // Safe, since quotes aren't used for this
  fontSize: numberInterpolation,
  fontStyle: stringInterpolation,
  fontWeight: stringInterpolation,
  lineHeight: numberInterpolation,
  textAlign: stringInterpolation,
  textDecorationLine: stringInterpolation,
  textShadowColor: stringInterpolation,
  textShadowRadius: numberInterpolation,
  textAlignVertical: stringInterpolation,
  letterSpacing: numberInterpolation,
  textDecorationColor: stringInterpolation,
  textDecorationStyle: stringInterpolation,
  writingDirection: stringInterpolation,
};

const extractRules = (element, state, inputCss, substitutionMap = {}) => {
  const substititionNames = Object.keys(substitutionMap);
  const substitionNamesRegExpNoCapture = new RegExp(`(?:${substititionNames.join('|')})`, 'g');
  const substitionNamesRegExp = new RegExp(`(${substititionNames.join('|')})`, 'g');

  const getInterpolationType = (decl) => {
    if (!_.some(value => _.includes(value, decl.value), substititionNames)) {
      return SIMPLE_OR_NO_INTERPOLATION;
    } else if (getPropertyName(decl.prop) in simpleInterpolation) {
      return SIMPLE_OR_NO_INTERPOLATION;
    }
    return ADVANCED_INTERPOLATION;
  };

  const getTemplateString = (value) => {
    /* Don't attempt to optimise `${value}`: it converts to a string and we need that */
    const quasiValues = value.split(substitionNamesRegExpNoCapture);
    const quasis = [].concat(
      _.map(raw => t.templateElement({ raw }), _.initial(quasiValues)),
      t.templateElement({ raw: _.last(quasiValues) }, true)
    );
    const expressions = _.map(
      _.propertyOf(substitutionMap),
      value.match(substitionNamesRegExp)
    );

    return t.templateLiteral(quasis, expressions);
  };

  const getBody = (nodes) => {
    const styleGroups = _.reduce((groups, node) => {
      if (node.type !== 'decl') return groups;

      const interpolationType = getInterpolationType(node);
      const lastGroup = _.last(groups);

      if (_.get('interpolationType', lastGroup) === interpolationType) {
        lastGroup.decls.push(node);
      } else {
        groups.push({ interpolationType, decls: [node] });
      }

      return groups;
    }, [], nodes);

    const transformedGroups = _.map(({ decls, interpolationType }) => {
      if (interpolationType === SIMPLE_OR_NO_INTERPOLATION) {
        const styleMap = _.reduce((accum, decl) => {
          const propertyName = getPropertyName(decl.prop);
          const substitutions = !_.isEmpty(substitutionMap)
            ? decl.value.match(substitionNamesRegExp)
            : null;

          if (substitutions && substitutions.length > 2) {
            throw new Error('Used two interpolated values on a property that accepts one');
          } else if (substitutions && substitutions.length === 1) {
            const substitution = substitutionMap[substitutions[0]];
            return _.set(propertyName, simpleInterpolation[propertyName](substitution), accum);
          }

          const styles = cssToReactNative([[propertyName, decl.value]]);
          const styleToValue = _.mapValues(jsonToNode, styles);
          return _.assign(accum, styleToValue);
        }, {}, decls);

        return t.objectExpression(_.map(([key, value]) => (
          t.objectProperty(t.stringLiteral(key), value)
        ), _.toPairs(styleMap)));
      }

      const cssToReactNativeReference = getOrCreateImportReference(
        element,
        state,
        'css-to-react-native',
        'default'
      );

      const bodyPairs = t.arrayExpression(_.map(decl => t.arrayExpression([
        t.stringLiteral(getPropertyName(decl.prop)),
        getTemplateString(decl.value),
      ]), decls));

      return t.callExpression(cssToReactNativeReference, [bodyPairs]);
    }, styleGroups);

    if (transformedGroups.length === 1) return transformedGroups[0];

    return t.callExpression(
      t.memberExpression(t.identifier('Object'), t.identifier('assign')),
      transformedGroups
    );
  };

  const { root, propTypes } = getRoot(inputCss);

  const ruleNodes = [];
  root.walkRules((node) => {
    ruleNodes.push(node);
  });

  const stylesheetBodies = _.map(rule => getBody(rule.nodes), ruleNodes);

  return { ruleNodes, stylesheetBodies, propTypes };
};

module.exports = (element, state, cssText, substitutionMap, component) => {
  let i = 0;
  const getStyleName = () => {
    i += 1;
    return `style${i}`;
  };

  const filename = state.file.opts.filename;

  const { ruleNodes, stylesheetBodies, propTypes } =
    extractRules(element, state, cssText, substitutionMap);
  const styleSheetReference = element.scope.generateUidIdentifier('csstaStyle');

  const styleNames = _.map(getStyleName, ruleNodes);

  const styleSheetBody = t.objectExpression(_.map(([styleName, body]) => (
    t.objectProperty(t.stringLiteral(styleName), body)
  ), _.zip(styleNames, stylesheetBodies)));

  const rules = t.arrayExpression(_.map(([styleName, rule]) => t.objectExpression([
    t.objectProperty(
      t.stringLiteral('validator'),
      createValidatorNodeForSelector(rule.selector)
    ),
    t.objectProperty(
      t.stringLiteral('style'),
      t.memberExpression(styleSheetReference, t.stringLiteral(styleName), true)
    ),
  ]), _.zip(styleNames, ruleNodes)));

  const createComponent = state.createComponentReferences[filename].native;
  const newElement = t.callExpression(createComponent, [
    component,
    jsonToNode(Object.keys(propTypes)),
    rules,
  ]);

  element.replaceWith(newElement);

  const reactNativeStyleSheetRef = getOrCreateImportReference(
    element,
    state,
    'react-native',
    'StyleSheet'
  );

  const styleSheetElement = t.variableDeclaration('var', [
    t.variableDeclarator(styleSheetReference, t.callExpression(
      t.memberExpression(reactNativeStyleSheetRef, t.identifier('create')),
      [styleSheetBody]
    )),
  ]);

  element.insertBefore(styleSheetElement);
};