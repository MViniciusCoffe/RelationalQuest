# Relational Quest

Jogos para aprender bancos de dados, em português:

- **Álgebra Relacional** (`/algebra`): 10 fases de tutorial, 50 desafios em 5 bancos de dados, playground livre, autocompletar e notação LaTeX.
- **Normalização** (`/normalizacao`): 9 aulas (anomalias, dependências funcionais, fecho e chaves, 1FN a 3FN, o roteiro da 0FN à 3FN, decomposição), 31 desafios (9 deles normalizam uma tabela da 0FN à 3FN, etapa por etapa) e um laboratório que analisa qualquer relação.

Feito com Next.js (App Router) e React. Todo o processamento roda no navegador.

## Rodar localmente

```bash
npm install
npm run dev     # http://localhost:3000
```

Produção: `npm run build && npm start`.

## Estrutura

- `app/`: páginas (`/`, `/algebra`, `/normalizacao`), layout e CSS global.
- `components/`: interface (compartilhada, `algebra/`, `normalization/`).
- `lib/algebra/`: avaliador de álgebra relacional, LaTeX, autocompletar, fases e bancos.
- `lib/normalization/`: motor de normalização (fecho, chaves, formas normais, chase, cobertura mínima, síntese 3FN) e conteúdo.
