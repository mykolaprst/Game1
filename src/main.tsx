import { render } from 'preact';
import '@fontsource/abril-fatface/400.css';
import './ui/styles.css';
import { App } from './ui/App';

render(<App />, document.getElementById('app')!);
