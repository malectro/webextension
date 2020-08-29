import * as React from 'react';
import {render} from 'react-dom';

import './archive/app.global.css';

import {App} from './archive/app';


const root = document.createElement('div');
root.id = 'app';
document.body.appendChild(root);

render(React.createElement(App), root);
