import {makeProject} from '@motion-canvas/core';
import './fonts.css';
import intro from './scenes/intro?scene';
import screens from './scenes/screens?scene';
import launcher from './scenes/launcher?scene';
import channels from './scenes/channels?scene';
import phone from './scenes/phone?scene';
import outro from './scenes/outro?scene';

await Promise.all(
  ['700 40px Kufi', '500 40px Plex', '700 40px Plex'].map(f =>
    document.fonts.load(f, 'مدير الشاشات Clean 190'),
  ),
);

export default makeProject({
  scenes: [intro, screens, launcher, channels, phone, outro],
});
