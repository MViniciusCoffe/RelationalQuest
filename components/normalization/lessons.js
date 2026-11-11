// The nine lessons of the normalization game. Examples are computed by the engine
// (closures, keys, violations, decompositions) instead of being written by hand.
import NF from '@/lib/normalization/engine';
import { nfSchemas as S } from '@/lib/normalization/content';
import RelationTable from '@/components/RelationTable';
import { FdList, Fd, KeyList, Schema, Trace, Violations, Decomposition, Spurious } from './ui';

const rel = (spec) => NF.relation(spec);
const Data = ({ spec, mark }) => <RelationTable title={spec.name} columns={spec.attrs} rows={spec.rows} mark={mark} />;
const Fds = ({ spec }) => <div className="lesson-fds"><span className="expect-label">Dependências</span><FdList fds={rel(spec).fds} /></div>;
const Keys = ({ spec }) => { const r = rel(spec); return <p className="lesson-keys"><span className="expect-label">Chaves candidatas</span><KeyList keys={NF.candidateKeys(r.attrs, r.fds)} /></p>; };
const LessonTrace = ({ spec, of }) => <Trace rel={rel(spec)} of={of} />;
const LessonViolations = ({ spec }) => <Violations rel={rel(spec)} />;
const Split = ({ spec, parts, names }) => (
  <div className="lesson-split">
    {parts.map((part, index) => <RelationTable key={index} title={names[index]} columns={part} rows={NF.projectRows(spec.attrs, spec.rows, part)} keyColumns={NF.candidateKeys(part, rel(spec).fds)[0]} />)}
  </div>
);
const Cover = ({ spec }) => { const r = rel(spec); return <div className="lesson-fds"><span className="expect-label">Cobertura mínima</span><FdList fds={NF.minimalCover(r.fds, r.attrs)} /></div>; };
function Algorithm({ spec, target }) {
  const r = rel(spec);
  const parts = target === 'FNBC' ? NF.decomposeBCNF(r.attrs, r.fds) : NF.synthesize3NF(r.attrs, r.fds);
  return (
    <>
      <p className="lesson-keys"><span className="expect-label">Exemplo</span><Schema name={r.name} attrs={r.attrs} /> com {r.fds.map((fd, index) => <Fd key={index} fd={fd} />)}</p>
      <Decomposition rel={r} parts={parts} target={target} />
    </>
  );
}
const Card = ({ title, formula, children }) => <div className="lesson-card"><b>{title}</b>{formula && <code>{formula}</code>}<span>{children}</span></div>;

export const nfLessons = [
  {
    title: 'Por que normalizar?', subtitle: 'Redundância vira contradição. Normalizar é fazer cada fato morar em um só lugar.',
    goal: 'Reconhecer as três anomalias que uma tabela mal projetada causa.', practice: 'Telefone duplicado',
    Body: () => (
      <>
        <p>Imagine guardar tudo sobre pedidos em uma única tabela. Parece prático, até alguém precisar mudar alguma coisa:</p>
        <Data spec={S.pedido} mark={[[0, 2], [1, 2], [0, 4], [2, 4]]} />
        <p>O telefone da Ana aparece duas vezes, e o preço do teclado também. Essa <b>redundância</b> causa três problemas, chamados <b>anomalias</b>:</p>
        <div className="lesson-cards">
          <Card title="Anomalia de atualização">A Ana trocou de telefone. É preciso alterar as duas linhas dela; se uma for esquecida, o banco passa a afirmar que ela tem dois telefones.</Card>
          <Card title="Anomalia de inserção">Chegou um produto novo, a Webcam, que ainda não foi vendida. Não há como registrar seu preço sem inventar um pedido.</Card>
          <Card title="Anomalia de remoção">Ao apagar o pedido 4, perdemos também o telefone da Carla e o preço do monitor, que só existiam nessa linha.</Card>
        </div>
        <p>A causa é sempre a mesma: a tabela mistura <b>vários assuntos</b> (clientes, produtos e pedidos). Separando cada assunto em sua tabela, cada fato aparece uma vez:</p>
        <Split spec={S.pedido} parts={[['cliente', 'telefone'], ['produto', 'preco'], ['idPedido', 'cliente', 'produto']]} names={['Cliente', 'Produto', 'Pedido']} />
        <div className="lesson-callout">
          <b>As formas normais são uma escada.</b> Cada degrau exige o anterior e elimina um tipo de redundância:
          <ol className="nf-ladder"><li><b>1FN</b> valores atômicos</li><li><b>2FN</b> sem dependência parcial da chave</li><li><b>3FN</b> sem dependência transitiva</li><li><b>FNBC</b> todo determinante é superchave</li></ol>
          Para subir os degraus, primeiro precisamos de uma ferramenta: a <b>dependência funcional</b>.
        </div>
      </>
    ),
  },
  {
    title: 'Dependências funcionais', subtitle: 'A regra que diz quais atributos determinam quais. É a base de toda a normalização.',
    goal: 'Ler e escrever dependências funcionais X → Y e usar os axiomas de Armstrong.', practice: 'O que o departamento determina',
    Body: () => (
      <>
        <p>Dizemos que <b>X determina Y</b>, e escrevemos <code>X → Y</code>, quando duas tuplas que concordam em X <b>sempre</b> concordam em Y. X é o <b>determinante</b>.</p>
        <Data spec={S.funcionario} mark={[[0, 3], [2, 3], [0, 4], [2, 4]]} />
        <Fds spec={S.funcionario} />
        <p>Ana e Bia estão no departamento D1, então obrigatoriamente têm o mesmo <code>nomeDepto</code> e o mesmo <code>gerente</code>: <code>depto → nomeDepto, gerente</code>. Já <code>matricula → nome, depto</code> diz que cada matrícula identifica um único funcionário.</p>
        <div className="lesson-callout"><b>Dependências vêm das regras do negócio, não dos dados.</b> Na tabela acima, cada nome aparece uma só vez, mas <code>nome → matricula</code> <em>não</em> é uma regra: amanhã pode chegar outra Ana. Os dados podem <em>refutar</em> uma dependência (duas tuplas que a violam), mas nunca a provam.</div>
        <h3>Dependências triviais</h3>
        <p><code>X → Y</code> é trivial quando Y está contido em X, como <code>matricula, nome → nome</code>. Vale sempre e não diz nada; os desafios ignoram dependências triviais.</p>
        <h3>Axiomas de Armstrong</h3>
        <p>A partir das dependências dadas, deduzimos outras com três regras. Elas são <em>corretas</em> (só deduzem o que é verdade) e <em>completas</em> (deduzem tudo que é verdade).</p>
        <div className="lesson-cards">
          <Card title="Reflexividade" formula="Y ⊆ X ⇒ X → Y"><code>matricula, nome → nome</code></Card>
          <Card title="Aumento" formula="X → Y ⇒ XZ → YZ"><code>matricula → depto</code> dá <code>matricula, nome → depto, nome</code></Card>
          <Card title="Transitividade" formula="X → Y, Y → Z ⇒ X → Z"><code>matricula → depto</code> e <code>depto → gerente</code> dão <code>matricula → gerente</code></Card>
        </div>
        <p>Delas saem regras derivadas muito usadas:</p>
        <div className="lesson-cards">
          <Card title="União" formula="X → Y, X → Z ⇒ X → YZ">Por isso escrevemos <code>matricula → nome, depto</code> numa linha só.</Card>
          <Card title="Decomposição" formula="X → YZ ⇒ X → Y">O lado direito pode ser separado; o esquerdo <em>não</em>.</Card>
          <Card title="Pseudotransitividade" formula="X → Y, WY → Z ⇒ WX → Z">Transitividade com atributos extras à esquerda.</Card>
        </div>
        <div className="lesson-callout warn"><b>Cuidado:</b> o lado esquerdo não se decompõe. <code>matricula, codDisc → nota</code> <em>não</em> implica <code>matricula → nota</code>: um aluno tem uma nota por disciplina.</div>
      </>
    ),
  },
  {
    title: 'Fecho e chaves', subtitle: 'Tudo o que um conjunto de atributos determina, e como isso revela as chaves.',
    goal: 'Calcular o fecho X⁺ e encontrar todas as chaves candidatas.', practice: 'Quem é a chave?',
    Body: () => (
      <>
        <p>O <b>fecho</b> de X, escrito <code>X⁺</code>, é o conjunto de todos os atributos determinados por X. O algoritmo é simples:</p>
        <ol className="lesson-steps"><li>Comece com <code>resultado = X</code>.</li><li>Procure uma dependência <code>A → B</code> cujo lado esquerdo esteja todo dentro do resultado; acrescente B.</li><li>Repita até nenhuma dependência acrescentar nada.</li></ol>
        <p>Veja o cálculo de <code>{'{depto}⁺'}</code> e de <code>{'{matricula}⁺'}</code> em Funcionario:</p>
        <Fds spec={S.funcionario} />
        <LessonTrace spec={S.funcionario} of={['depto']} />
        <LessonTrace spec={S.funcionario} of={['matricula']} />
        <h3>Superchave, chave candidata e atributo primo</h3>
        <div className="lesson-cards">
          <Card title="Superchave">X tal que <code>X⁺</code> contém <em>todos</em> os atributos. <code>{'{matricula, nome}'}</code> é superchave.</Card>
          <Card title="Chave candidata">Superchave <em>mínima</em>: tirando qualquer atributo, deixa de ser superchave. <code>{'{matricula}'}</code> é chave; <code>{'{matricula, nome}'}</code> não.</Card>
          <Card title="Atributo primo">Aparece em <em>alguma</em> chave candidata. As formas normais tratam primos e não primos de forma diferente.</Card>
        </div>
        <h3>Como achar todas as chaves</h3>
        <ol className="lesson-steps"><li>Atributos que <b>nunca aparecem à direita</b> de uma dependência estão em <b>toda</b> chave: ninguém os determina.</li><li>Calcule o fecho desse núcleo. Se já é tudo, ele é a única chave.</li><li>Senão, acrescente os outros atributos um a um, depois dois a dois…, descartando conjuntos que contêm uma chave já encontrada.</li></ol>
        <p>Uma relação pode ter várias chaves. Em Pessoa, cpf e email se determinam mutuamente:</p>
        <Fds spec={S.pessoa} />
        <Keys spec={S.pessoa} />
      </>
    ),
  },
  {
    title: 'Primeira forma normal', subtitle: '1FN: uma célula, um valor.',
    goal: 'Identificar atributos multivalorados e corrigi-los.', practice: 'Células lotadas',
    Body: () => (
      <>
        <p>Uma relação está na <b>1FN</b> quando todo atributo é <b>atômico</b>: cada célula guarda um único valor, sem listas e sem grupos que se repetem.</p>
        <RelationTable columns={['matricula', 'nome', 'telefones']} rows={[['101', 'Ana', '8499-1111, 8498-0000'], ['102', 'Caio', '8497-2222'], ['103', 'Bia', '8496-3333, 8495-4444, 8494-5555']]} mark={[[0, 2], [2, 2]]} />
        <p>Com <code>telefones</code> como lista, perguntar “de quem é o telefone 8498-0000?” exige procurar dentro do texto, e não há como garantir que cada telefone seja válido.</p>
        <div className="lesson-callout warn"><b>Não resolva com colunas repetidas.</b> <code>telefone1, telefone2, telefone3</code> é um <em>grupo repetitivo</em>: limita a três telefones e deixa células vazias.</div>
        <p>A correção é mover o atributo multivalorado para uma tabela própria, com uma linha por valor. A chave da nova tabela é a combinação dos dois atributos:</p>
        <div className="lesson-split">
          <RelationTable title="Funcionario" columns={['matricula', 'nome']} rows={[['101', 'Ana'], ['102', 'Caio'], ['103', 'Bia']]} />
          <RelationTable title="Telefone" columns={['matricula', 'telefone']} rows={[['101', '8499-1111'], ['101', '8498-0000'], ['102', '8497-2222'], ['103', '8496-3333'], ['103', '8495-4444'], ['103', '8494-5555']]} />
        </div>
        <p>Atomicidade depende do uso: um <code>endereco</code> em texto único é atômico se o sistema nunca filtra por cidade; se filtra, separe em <code>rua</code>, <code>cidade</code>, <code>cep</code>.</p>
        <p>Daqui em diante, todas as relações dos desafios já estão na 1FN.</p>
      </>
    ),
  },
  {
    title: 'Segunda forma normal', subtitle: '2FN: nenhum atributo depende de só um pedaço da chave.',
    goal: 'Encontrar dependências parciais e removê-las.', practice: 'Notas e nomes',
    Body: () => (
      <>
        <p>Uma relação está na <b>2FN</b> quando está na 1FN e nenhum atributo <b>não primo</b> depende de <b>parte</b> de uma chave candidata. Esse tipo de dependência se chama <b>parcial</b>.</p>
        <Data spec={S.escola} mark={[[0, 2], [1, 2], [0, 4], [2, 4]]} />
        <Fds spec={S.escola} />
        <Keys spec={S.escola} />
        <p>A chave é <code>{'{matricula, codDisc}'}</code>, mas <code>nomeAluno</code> depende só de <code>matricula</code> e <code>nomeDisc</code> só de <code>codDisc</code>. Por isso o nome da Ana se repete a cada disciplina que ela cursa.</p>
        <LessonViolations spec={S.escola} />
        <p><b>Correção:</b> cada dependência parcial vira uma tabela com o pedaço da chave como chave. Na original fica só o que depende da chave inteira:</p>
        <Split spec={S.escola} parts={[['matricula', 'nomeAluno', 'curso'], ['codDisc', 'nomeDisc', 'creditos'], ['matricula', 'codDisc', 'nota']]} names={['Aluno', 'Disciplina', 'Historico']} />
        <div className="lesson-callout"><b>Atalho:</b> se todas as chaves candidatas têm um único atributo, não existe “parte da chave”, então a relação já está na 2FN.</div>
      </>
    ),
  },
  {
    title: 'Terceira forma normal', subtitle: '3FN: atributos não primos dependem da chave, e de nada além dela.',
    goal: 'Encontrar dependências transitivas e removê-las.', practice: 'Editoras repetidas',
    Body: () => (
      <>
        <p>Uma relação está na <b>3FN</b> quando está na 2FN e nenhum atributo não primo depende <b>transitivamente</b> da chave, isto é, por meio de outro atributo que não é chave: <code>chave → X → A</code>.</p>
        <Data spec={S.funcionario} mark={[[0, 3], [2, 3], [1, 4], [3, 4]]} />
        <Fds spec={S.funcionario} />
        <p>A chave é <code>matricula</code>. Mas <code>nomeDepto</code> e <code>gerente</code> chegam a ela por <code>depto</code>: <code>matricula → depto → gerente</code>. Por isso “Rui” se repete para todo funcionário do D1.</p>
        <LessonViolations spec={S.funcionario} />
        <p><b>Correção:</b> a dependência transitiva vira uma tabela; <code>depto</code> fica nas duas, como chave estrangeira.</p>
        <Split spec={S.funcionario} parts={[['matricula', 'nome', 'depto'], ['depto', 'nomeDepto', 'gerente']]} names={['Funcionario', 'Departamento']} />
        <div className="lesson-callout"><b>Definição formal (a que o jogo usa):</b> para toda dependência não trivial <code>X → A</code>, <b>X é superchave</b> ou <b>A é primo</b>. Ela já cobre a 2FN.<br />Resumo clássico: todo atributo não primo depende <em>da chave</em> (1FN), <em>da chave inteira</em> (2FN) e <em>de nada além da chave</em> (3FN).</div>
      </>
    ),
  },
  {
    title: 'Forma normal de Boyce-Codd', subtitle: 'FNBC: todo determinante é superchave. Sem exceções.',
    goal: 'Distinguir 3FN de FNBC e saber o preço de chegar à FNBC.', practice: 'Professor de uma disciplina só',
    Body: () => (
      <>
        <p>A 3FN tem uma brecha: aceita <code>X → A</code> com X não superchave <em>se A for primo</em>. A <b>FNBC</b> fecha a brecha: para toda dependência não trivial <code>X → A</code>, <b>X é superchave</b>.</p>
        <p>Cada aluno tem um professor por disciplina, e cada professor dá uma só disciplina:</p>
        <Data spec={S.agenda} mark={[[0, 1], [1, 1]]} />
        <Fds spec={S.agenda} />
        <Keys spec={S.agenda} />
        <p>Todos os atributos são primos, então a relação está na 3FN. Mas <code>professor → disciplina</code> tem determinante que não é superchave: o fato “Rita dá BD” se repete para cada aluno dela.</p>
        <LessonViolations spec={S.agenda} />
        <Split spec={S.agenda} parts={[['professor', 'disciplina'], ['aluno', 'professor']]} names={['Leciona', 'Cursa']} />
        <div className="lesson-callout warn"><b>O preço:</b> a decomposição é sem perda, mas <code>aluno, disciplina → professor</code> não cabe em nenhuma das tabelas. O banco não consegue mais impedir que um aluno tenha dois professores de BD sem uma verificação extra. Por isso, às vezes, projetistas param na 3FN.</div>
        <p>Isso só acontece quando há <b>chaves candidatas compostas que se sobrepõem</b> (aqui, ambas contêm <code>aluno</code>). Sem isso, 3FN e FNBC coincidem.</p>
      </>
    ),
  },
  {
    title: 'Decomposições boas', subtitle: 'Separar tabelas sem perder informação nem regras.',
    goal: 'Testar junção sem perda e preservação de dependências.', practice: 'Junção traiçoeira',
    Body: () => (
      <>
        <p>Toda correção até aqui foi uma <b>decomposição</b>: trocar R por várias tabelas menores. Uma decomposição boa tem duas propriedades.</p>
        <h3>1. Junção sem perda</h3>
        <p>Juntando as partes (⨝) obtemos <b>exatamente</b> a relação original: nenhuma tupla falsa aparece. Para duas partes, existe um teste rápido:</p>
        <div className="lesson-callout"><b>R₁ ∩ R₂ → R₁</b> ou <b>R₁ ∩ R₂ → R₂</b>: os atributos em comum precisam ser superchave de uma das partes.</div>
        <p>Veja o que acontece ao separar Aluno por <code>curso</code>, que não é chave de nenhum lado:</p>
        <Fds spec={S.alunoCidade} />
        <Spurious rel={rel(S.alunoCidade)} parts={[['matricula', 'curso'], ['curso', 'cidade']]} />
        <p>Separando pela chave, <code>(matricula, curso)</code> e <code>(matricula, cidade)</code>, o atributo comum <code>matricula</code> determina tudo e a junção volta exata. Com mais de duas partes, o jogo usa o <b>teste do chase</b>, que generaliza essa ideia.</p>
        <h3>2. Preservação de dependências</h3>
        <p>Cada dependência original deve poder ser verificada <b>dentro</b> das tabelas, sozinha ou deduzida das dependências de cada parte. Senão, garantir a regra exige juntar tabelas a cada inserção.</p>
        <p>Para testar <code>X → Y</code>: comece com X; para cada parte Rᵢ, acrescente <code>(resultado ∩ Rᵢ)⁺ ∩ Rᵢ</code>; repita. A dependência é preservada se Y aparecer no resultado.</p>
        <div className="lesson-cards">
          <Card title="Síntese para 3FN">Sempre sem perda <em>e</em> preserva dependências.</Card>
          <Card title="Decomposição para FNBC">Sempre sem perda, mas pode perder dependências (como em Agenda).</Card>
        </div>
      </>
    ),
  },
  {
    title: 'Algoritmos de normalização', subtitle: 'Cobertura mínima, síntese 3FN e decomposição FNBC, passo a passo.',
    goal: 'Aplicar os algoritmos que normalizam qualquer relação.', practice: 'Cobertura enxuta',
    Body: () => (
      <>
        <h3>Cobertura mínima</h3>
        <p>Um conjunto de dependências equivalente ao original, sem nada sobrando:</p>
        <ol className="lesson-steps"><li><b>Lado direito unitário:</b> troque <code>X → A, B</code> por <code>X → A</code> e <code>X → B</code>.</li><li><b>Sem atributos estranhos à esquerda:</b> em <code>X → A</code>, tire B de X se <code>(X − B)⁺</code> ainda contém A.</li><li><b>Sem dependências redundantes:</b> remova <code>X → A</code> se, sem ela, A ainda está em <code>X⁺</code>.</li></ol>
        <Fds spec={S.produto} />
        <Cover spec={S.produto} />
        <h3>Síntese para 3FN</h3>
        <ol className="lesson-steps"><li>Calcule uma cobertura mínima.</li><li>Para cada lado esquerdo X, crie uma tabela com X e tudo que ele determina na cobertura.</li><li>Se nenhuma tabela contém uma chave candidata, crie uma com uma chave.</li><li>Remova tabelas contidas em outras.</li></ol>
        <Algorithm spec={S.produto} target="3FN" />
        <h3>Decomposição para FNBC</h3>
        <ol className="lesson-steps"><li>Ache uma dependência <code>X → A</code> que viole a FNBC em alguma tabela R.</li><li>Troque R por <code>X⁺ ∩ R</code> e <code>R − (X⁺ − X)</code>.</li><li>Repita até todas as tabelas estarem na FNBC.</li></ol>
        <Algorithm spec={S.cep} target="FNBC" />
        <h3>Cola das formas normais</h3>
        <div className="table-scroll">
          <table className="relation-table cheat">
            <thead><tr><th>Forma</th><th>Exige</th><th>Viola quando</th><th>Correção</th></tr></thead>
            <tbody>
              <tr><td>1FN</td><td>Valores atômicos</td><td>Lista ou grupo repetido numa célula</td><td>Tabela com uma linha por valor</td></tr>
              <tr><td>2FN</td><td>1FN, sem dependência parcial</td><td>Parte de uma chave → atributo não primo</td><td>Tabela para o pedaço da chave</td></tr>
              <tr><td>3FN</td><td>X superchave ou A primo</td><td>Não chave → atributo não primo</td><td>Tabela para o determinante</td></tr>
              <tr><td>FNBC</td><td>X sempre superchave</td><td>Não chave → atributo primo</td><td>Separar pelo determinante (pode perder DF)</td></tr>
            </tbody>
          </table>
        </div>
        <p>Além da FNBC existem a <b>4FN</b> (dependências multivaloradas, como “um professor tem vários idiomas e vários cursos, independentes”) e a <b>5FN</b> (dependências de junção). Elas são raras na prática e ficam fora deste jogo.</p>
      </>
    ),
  },
];
