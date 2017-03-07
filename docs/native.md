---
layout: page
title: Native
permalink: /native
---

# 📱 Native

For React Native, you need to import `cssta/native`, and unlike the web version, there's no `cssta.View` syntax. Other than that, it works as normal.

```jsx
import { cssta } from 'cssta/native';
import { Text } from 'react-native';

const StyledView = cssta(Text)`
  color: red;
`;
```

## 📝 CSS Support

Cssta for React Native supports all the CSS React Native supports, and has the same syntax as your browser.

```css
font-size: 12px;
color: red;
```

There is also support for more complicated attributes.

```css
shadow-offset: 10px 5px;  /* { width: 10, height: 5 } */
font-variant: small-caps; /* ['small-caps'] */
transform: scale(3) rotate(30deg); /* [{ scale: 3 }, { rotate: '30deg' }] */
```

And support for short-hands:

```css
margin: 0px 5px; /* { marginTop: 0, marginRight: 5, ... } */
font: bold italic 12px/18px "Helvetica";
```

For more information, see [css-to-react-native](https://www.npmjs.com/package/css-to-react-native).

## 🎚 Polyfills

There are built-in polyfills for the following.

* Transitions (See below)
* CSS custom properties (`var(--property)`)
* CSS color function (`color(red tint(50%))`, see [spec](https://drafts.csswg.org/css-color/#modifying-colors))

These work the same as in CSS.

Note that the `color` function is subject to change when the spec is complete.

## 🔍 Selectors

The only selectors supported on React Native are,

* `[boolAttribute]`
* `[stringAttribute="stringValue"]`
* `:not(...)`
* `:matches(...)`

And these selectors work as normal.

```jsx
cssta(Text)`
  [color="red"] { ... }

  :matches([color="red"], [color="blue"]) { ... }

  :not([allowOverflow]) { ... }
`;
```

Cssta for React Native does not use specificity: rules get applied in the order defined.

## 📹 Transitions

Cssta has a lightweight wrapper for CSS transitions. You’ll need to use a `Animated` component (usually `Animated.View`) for this, and then define transitions as you would in CSS.

```jsx
const AnimatedButton = cssta(Animated.View)`
  background-color: blue;

  transition: background-color 0.5s ease-in;

  [disabled] {
    background-color: grey;
  }
`;
```

You can animate between CSS custom properties.

⚠️ We aren’t a full-blown CSS engine, so there are a few caveats—but these shouldn’t hinder you too much.

All properties that are transitioned must defined in the top level (without a selector) so we know a default value to use—in the case above, `background-color` was defined in the top level.

You can’t use shorthand properties in the transition property, including things like `border-width`. You can have `border-width: 5px` transition to `border-width: 10px 20px`, but you’ll need to write `transition: border-top-width border-right-width … 1s`.

You can animate multiple transitions, but the nodes of the transition must not change. You can animate `transition: scaleX(1) rotateX(0deg)` to `transition: scaleX(5) rotateX(30deg)`, but you cannot then transition to `transition: scaleY(2)`.

## 🎥 Custom Animations

To get React Native animations working, you’ll want to define all your non-changing styles in the usual way, and then pass your `Animated.Value`s in as style props.

```jsx
const BaseStyles = cssta(View)`
  height: 100px;
  width: 100px;
  background-color: red;
`

class AnimateOpacity extends Component {
  constructor() {
    super();

    this.state = {
      opacity: new Animated.Value(0)
    };
  }

  componentWillMount() {
    Animated.timing(this.state.opacity, {
      toValue: 1,
      duration: 1000,
    }).start();
  }

  render() {
    const { opacity } = this.state;
    // Pass in your animated values here!
    return <BaseStyles style={{ opacity }} />;
  }
}
```

## 💉 Injecting Variables

You can use `VariablesProvider` to dynamically set variables. This accepts an `exportedVariables` property, which is a map of variables to inject. It can also be a function that when called with the variables from the scope will return this map.

```jsx
import { VariablesProvider } from 'cssta/native';

<VariablesProvider exportedVariables={{ color: ‘red' }}>
  <ComponentsThatUseColorVariable />
</Variables>
```

```jsx
const getExportedVariables = (variablesFromScope) => {
  const { marginHorizontal, marginVertical } = variablesFromScope;
  const margin = ${marginHorizontal} ${marginVertical}`;
  return { margin };
};

<VariablesProvider exportedVariables={getExportedVariables}>
  <ComponentsThatUseColorVariable />
</Variables>
```