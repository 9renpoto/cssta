// @flow
const selectorParser = require("postcss-selector-parser");
const useMediaQuery = require("./useMediaQuery");

/*::
type SelectorNode = {
  type: string,
  value: any,
  attribute: string,
  raws: any,
  nodes: SelectorNode[],
  toString: () => string,
}

type Validator = ?string
*/

const combineLogicalValidators = (
  babel,
  operator /*: string */,
  validators /*: Validator[] */
) /*: Validator */ => {
  const { types: t } = babel;
  if (validators.length === 0) {
    throw new Error("Cannot construct logical validaton");
  }
  // $FlowFixMe
  const nodeValidators /*: string[] */ = validators.filter(v => v != null);
  if (nodeValidators.length === 0) return null;
  return nodeValidators
    .slice(1)
    .reduce(
      (accum, validator) => t.logicalExpression(operator, accum, validator),
      nodeValidators[0]
    );
};

const createLogicalValidator = (babel, operator, nodes) =>
  combineLogicalValidators(
    babel,
    operator,
    nodes.map(node => createValidator(babel, node))
  ); // eslint-disable-line

const createAlwaysTrueValidator = () /*: Validator */ => null;

const createAttributeValidator = (
  babel,
  node /*: SelectorNode */
) /*: Validator */ => {
  const { types: t } = babel;
  const { value } = node;
  const attribute = node.attribute.trim();
  if (node.ns !== "cssta") {
    throw new Error(
      `You can only use prop selectors (did you forget an @ before ${attribute})`
    );
  }

  const prop = t.identifier(attribute);
  const valueNode = value
    ? t.stringLiteral(value.trim())
    : t.booleanLiteral(true);

  return t.binaryExpression("===", prop, valueNode);
};

const createPseudoValidator = (
  babel,
  node /*: SelectorNode */
) /*: Validator */ => {
  const { types: t } = babel;
  const { value, nodes } = node;

  if (value === ":matches") {
    return createLogicalValidator(babel, "||", nodes);
  } else if (value === ":not") {
    const baseValidator = createLogicalValidator(babel, "||", nodes);
    return baseValidator ? t.unaryExpression("!", baseValidator) : null;
  }
  throw new Error(`Invalid selector part: ${node.toString()}`);
};

const createSelectorValidator = (
  babel,
  node /*: SelectorNode */
) /* Validator */ => createLogicalValidator(babel, "&&", node.nodes);

const validators = {
  universal: createAlwaysTrueValidator,
  nesting: createAlwaysTrueValidator,
  attribute: createAttributeValidator,
  pseudo: createPseudoValidator,
  selector: createSelectorValidator,
  root: createSelectorValidator
};

const createValidator = (babel, node /*: SelectorNode */) /*: Validator */ => {
  if (!(node.type in validators)) {
    throw new Error(`Invalid selector part: ${node.toString()}`);
  }
  return validators[node.type](babel, node);
};

const aspectRatioWH = ({ types: t }, str) => {
  const [w, h] = str
    .split("/")
    .map(x => x.trim())
    .map(Number);
  return t.binaryExpression("/", t.numericLiteral(w), t.numericLiteral(h));
};

const createMediaFeatureValidator = (babel, query, screenVariables) => {
  const { types: t } = babel;
  const match = query.match(/^\s*\(\s*([\w-]+)\s*:\s*(\S+(?:\s\S)*)\s*\)\s*$/);

  if (match == null) throw new Error(`Could not parse media query: ${query}`);

  switch (match[1]) {
    // case "platform":
    //   return `(${JSON.stringify(
    //     match[2].toLowerCase()
    //   )} === ${propArg}.$Platform)`;
    case "width":
      return t.binaryExpression(
        "===",
        screenVariables.width,
        t.numericLiteral(parseInt(match[2], 10))
      );
    case "min-width":
      return t.binaryExpression(
        ">=",
        screenVariables.width,
        t.numericLiteral(parseInt(match[2], 10))
      );
    case "max-width":
      return t.binaryExpression(
        "<=",
        screenVariables.width,
        t.numericLiteral(parseInt(match[2], 10))
      );
    case "height":
      return t.binaryExpression(
        "===",
        screenVariables.height,
        t.numericLiteral(parseInt(match[2], 10))
      );
    case "min-height":
      return t.binaryExpression(
        ">=",
        screenVariables.height,
        t.numericLiteral(parseInt(match[2], 10))
      );
    case "max-height":
      return t.binaryExpression(
        "<=",
        screenVariables.height,
        t.numericLiteral(parseInt(match[2], 10))
      );
    case "aspect-ratio": {
      return t.binaryExpression(
        "===",
        aspectRatioWH(babel, match[2]),
        t.binaryExpression("/", screenVariables.width, screenVariables.height)
      );
    }
    case "min-aspect-ratio": {
      return t.binaryExpression(
        "<=",
        aspectRatioWH(babel, match[2]),
        t.binaryExpression("/", screenVariables.width, screenVariables.height)
      );
    }
    case "max-aspect-ratio": {
      return t.binaryExpression(
        ">=",
        aspectRatioWH(babel, match[2]),
        t.binaryExpression("/", screenVariables.width, screenVariables.height)
      );
    }
    case "orientation":
      if (/landscape/i.test(match[2])) {
        return t.binaryExpression(
          ">",
          screenVariables.width,
          screenVariables.height
        );
      } else if (/portrait/i.test(match[2])) {
        return t.binaryExpression(
          "<",
          screenVariables.width,
          screenVariables.height
        );
      }
    // fallthrough
    default:
      throw new Error(`Could not parse media query: ${query}`);
  }
};

const createMediaQueryValidator = (babel, mediaQuery, screenVariables) => {
  if (mediaQuery == null) return null;

  const createMediaQueryPartValidator = queryPart =>
    combineLogicalValidators(
      babel,
      "&&",
      (queryPart.match(/\([^()]+\)/g) || []).map(query =>
        createMediaFeatureValidator(babel, query, screenVariables)
      )
    );

  const mediaQueryValidators = mediaQuery
    .split(",")
    .map(createMediaQueryPartValidator);
  const mediaQueryValidator = combineLogicalValidators(
    babel,
    "||",
    mediaQueryValidators
  );
  return mediaQueryValidator;
};

const selectorTransform = (
  babel,
  { selector, mediaQuery },
  { screenVariables }
) => {
  let selectorNode;
  selectorParser(node => {
    selectorNode = node;
  }).processSync(selector);
  if (!selectorNode) throw new Error("Expected to parse selector");

  const validatorNode = combineLogicalValidators(babel, "&&", [
    createValidator(babel, selectorNode),
    createMediaQueryValidator(babel, mediaQuery, screenVariables)
  ]);

  return validatorNode;
};

module.exports = (babel, path, { ruleTuples }) => {
  let screenVariables;
  if (ruleTuples.some(rule => rule.mediaQuery != null)) {
    screenVariables = useMediaQuery(babel, path);
  }

  const selectorFunctions = ruleTuples.reduce((accum, rule) => {
    const ruleCondition = selectorTransform(babel, rule, { screenVariables });
    if (ruleCondition != null) accum.set(rule.selector, ruleCondition);
    return accum;
  }, new Map());

  return selectorFunctions;
};
