const { getPropertyName } = require("css-to-react-native");
const {
  getDurationInMs,
  durationRegExp,
  easingRegExp
} = require("./animationShorthandUtil");

const DELAY = 1;
const DURATION = 1 << 1;
const TIMING_FUNCTION = 1 << 2;
const PROPERTY = 1 << 3;

const getTransitionShorthand = shorthandParts => {
  const accum = {
    delay: 0,
    duration: 0,
    timingFunction: "ease",
    property: null
  };
  let set = 0;

  shorthandParts.forEach(part => {
    if (!(set & TIMING_FUNCTION) && easingRegExp.test(part)) {
      accum.timingFunction = part;
      set &= TIMING_FUNCTION;
    } else if (!(set & DURATION) && durationRegExp.test(part)) {
      accum.duration = getDurationInMs(part);
      set &= DURATION;
    } else if (!(set & DELAY) && durationRegExp.test(part)) {
      accum.delay = getDurationInMs(part);
      set &= DELAY;
    } else if (!(set & PROPERTY)) {
      accum.property = getPropertyName(part);
      set &= PROPERTY;
    } else {
      throw new Error("Failed to parse shorthand");
    }
  });

  return accum;
};

const split = value => value.trim().split(/\s*,\s*/);

module.exports = styles => {
  let delays = [];
  let durations = [];
  let timingFunctions = [];
  let properties = [];

  styles.forEach(style => {
    if (style == null) return;

    if (style._ != null) {
      delays = [];
      durations = [];
      timingFunctions = [];
      properties = [];

      split(style._).forEach(shorthand => {
        const resolved = getTransitionShorthand(shorthand.trim().split(/\s+/));
        timingFunctions.push(resolved.timingFunction);
        delays.push(resolved.delay);
        durations.push(resolved.duration);
        properties.push(resolved.property);
      });
    }
    if (style.timingFunction != null) {
      timingFunctions = split(style.timingFunction);
    }
    if (style.delay != null) {
      delays = split(style.delay).map(getDurationInMs);
    }
    if (style.duration != null) {
      durations = split(style.duration).map(getDurationInMs);
    }
    if (style.property != null) {
      properties =
        style.property === "none"
          ? []
          : split(style.property).map(getPropertyName);
    }
  });

  const transitions = properties.map((property, index) => {
    /*
    Per spec, cycle through multiple values if transition-property length
    exceeds the length of the other property
    */
    const delay = delays[index % delays.length];
    const duration = durations[index % durations.length];
    const timingFunction = timingFunctions[index % timingFunctions.length];
    return { property, timingFunction, delay, duration };
  });

  return transitions;
};
