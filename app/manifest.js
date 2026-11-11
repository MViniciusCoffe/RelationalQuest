export default function manifest() {
  return {
    name: 'Relational Quest',
    short_name: 'RelQuest',
    description: 'Aprenda álgebra relacional e normalização de bancos de dados jogando.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f6f1e8',
    theme_color: '#f6f1e8',
    lang: 'pt-BR',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
