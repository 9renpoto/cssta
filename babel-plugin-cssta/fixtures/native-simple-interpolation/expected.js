import _csstaCreateComponent from 'cssta/lib/native/createComponent';

import { View } from 'react-native';

const color = 'red';

import { StyleSheet as _StyleSheet } from 'react-native';

var _csstaStyle = _StyleSheet.create({
  'style1': {
    'marginTop': 10,
    'color': String(color).trim()
  },
  'style2': {
    'color': String(color).trim(),
    'marginTop': 10
  },
  'style3': {
    'marginTop': 10,
    'color': String(color).trim(),
    'marginBottom': 10
  }
});

_csstaCreateComponent(View, ['attr1', 'attr2', 'attr3'], [{
  'validator': function (p) {
    return !!p['attr1'];
  },
  'style': _csstaStyle['style1']
}, {
  'validator': function (p) {
    return !!p['attr2'];
  },
  'style': _csstaStyle['style2']
}, {
  'validator': function (p) {
    return !!p['attr3'];
  },
  'style': _csstaStyle['style3']
}]);