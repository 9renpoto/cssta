---
layout: page
title: Theming
permalink: /theming/
---

# 🏳️‍🌈 Theming

Theming in Cssta should be done by CSS custom properties. To define CSS variables, you just define a property starting with a double dash (`--`).

```jsx
const Root = cssta(View)`
  --primary: red;
`;
```

You can then use the variables using the `var` function. Note that the variable can be combined with other values, including more variables.

```jsx
const Button = cssta(View)`
  border: 1px solid var(--primary);
  padding: 0.5rem 1rem;
`;
```

You can redefine variables in any component, and their descendants will use the updated values.

```jsx
const LightBox = cssta(View)`
  background-color: black;
  --primary: white;
`;

<LightBox>
  <Button>I am white on black!</Button>
</LightBox>;
```

You can also dynamically change the values of the variables through prop selectors.

```jsx
const LightBox = cssta(View)`
  background-color: black;
  --primary: white;

  &[@inverted] {
    background-color: white;
    --primary: black;
  }
`;

<LightBox inverted>
  <Button>I am black on white!</Button>
</LightBox>;
```

## 💉 Using JavaScript Variables

If you need more control over variables, there’s `VariablesProvider` component. Just pass in an object of your variables omitting the double dash. You can see more information over in [custom properties]({{ site.baseurl }}/custom-properties).

```jsx
import VariablesContext from "cssta/runtime/VariablesContext";

<VariablesContext.Provider value={% raw %}{{ color: "red" }}{% endraw %}>
  <ComponentsThatUseColorVariable />
</VariablesContext.Provider>;
```

## 🌍 Global Variables

If all your custom properties are global, you can configure them in the Cssta build configuration. There’s more information on this over in the [configuration]({{ site.baseurl }}/configuration) section.
