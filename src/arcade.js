import './arcade.css';
import './site.js';

// A page and a card are all a game needs to join the collection.
const games = [
  {
    id: 'voidline', number: '01', name: 'VOIDLINE', genre: 'PRECISION / ENDLESS FLIGHT',
    tagline: 'Thread the storm.', description: 'Skim neon gates. Ride the edge. Keep your flow.',
    controls: 'WASD / arrows or pointer', url: './voidline.html',
    art: '<i class="gate one"></i><i class="gate two"></i><i class="gate three"></i><i class="ship"></i>',
  },
  {
    id: 'ringriot', number: '02', name: 'RING RIOT', genre: 'PHYSICS / ARENA SURVIVAL',
    tagline: 'Make some space.', description: 'Gather the crowd. Charge your pulse. Send them flying.',
    controls: 'Move + hold / release to blast', url: './ring-riot.html',
    art: '<i class="arena-disc"></i><i class="pulse"></i><i class="orb hero"></i><i class="orb rival a"></i><i class="orb rival b"></i><i class="orb rival c"></i>',
  },
  {
    id: 'skyslice', number: '03', name: 'SKYSLICE', genre: 'TIMING / TOWER BUILDING',
    tagline: 'A little higher.', description: 'Stack the sky. Trim the excess. Make every slice count.',
    controls: 'One button: Space / click / tap', url: './skyslice.html',
    art: '<div class="stack-art"><i></i><i></i><i></i><i></i><i></i><i></i></div><i class="offcut"></i>',
  },
  {
    id: 'bankshot', number: '04', name: 'BANKSHOT', genre: 'ANGLES / RICOCHET PUZZLER',
    tagline: 'One ball. All the angles.', description: 'Bank off the rails. Chain the breaks. Hold the line.',
    controls: '← → aim + Space / drag + release', url: './bankshot.html',
    art: '<div class="bank-table"><i class="bank-block a"></i><i class="bank-block b"></i><i class="bank-block c"></i><i class="bank-block d"></i><i class="bank-path"></i><i class="bank-ball"></i></div>',
  },
];
document.querySelector('#games').innerHTML = games.map(game => `
  <a class="game-card ${game.id}" href="${game.url}" aria-label="Play ${game.name}">
    <div class="card-art" aria-hidden="true">${game.art}<span class="game-number">${game.number}</span>${game.number === '04' ? '<span class="new-badge">NEW ARRIVAL</span>' : ''}</div>
    <div class="card-copy"><p class="genre">${game.genre}</p><h2>${game.name}</h2><p class="tagline">${game.tagline}</p><p class="description">${game.description}</p><div class="card-bottom"><span>${game.controls}</span><b>PLAY ↗</b></div></div>
  </a>`).join('');
document.body.dataset.arcadeReady = 'true';
