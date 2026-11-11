'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const Rule = ({ title, code, children }) => (
  <div className="full-rule"><b>{title}</b><code>{code}</code><span>{children}</span></div>
);

function RulesModal({ onClose }) {
  const closeButton = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    closeButton.current?.focus();
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, [onClose]);

  return (
    <div className="rules-modal" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="rules-dialog" role="dialog" aria-modal="true" aria-labelledby="full-rules-title">
        <div className="rules-dialog-header">
          <div>
            <span className="panel-index">REFERÊNCIA COMPLETA</span>
            <h2 id="full-rules-title">Álgebra Relacional</h2>
            <p>Monte uma consulta por etapas: cada operador recebe uma ou duas relações e devolve uma nova relação.</p>
          </div>
          <button className="close-rules" ref={closeButton} type="button" aria-label="Fechar regras" onClick={onClose}>×</button>
        </div>
        <div className="full-rules-grid">
          <section>
            <h3>Operadores unários</h3>
            <Rule title="σ Seleção" code="σ_{condição}(R)">Mantém só as tuplas que satisfazem a condição; as colunas não mudam. Ex.: <code>{"σ_{nomeE='Carlos'}(Empregado)"}</code>.</Rule>
            <Rule title="π Projeção" code="π_{coluna1,coluna2}(R)">Mantém só os atributos listados, separados por vírgula, e remove tuplas repetidas. Ex.: <code>{'π_{nomeE,salario}(Empregado)'}</code>.</Rule>
            <Rule title="ρ Renomeação" code="ρ_{E}(R)">Dá o nome <code>E</code> à relação; o nome aparece no resultado e <code>E</code> pode ser usado nas instruções seguintes.</Rule>
            <Rule title="ρ Renomear atributos" code="ρ_{E(a, b, c)}(R)">Renomeia a relação e <em>todas</em> as colunas, na ordem. Use <code>{'ρ_{(a, b, c)}(R)'}</code> para mudar só as colunas.</Rule>
            <Rule title="ρ Renomear uma coluna" code="ρ_{novo←antigo}(R)">Muda só as colunas indicadas; separe várias com vírgula. Também vale <code>{'ρ_{antigo→novo}(R)'}</code>, <code>{'<-'}</code>, <code>{'->'}</code> ou <code>novo/antigo</code>. A tabela resultante mostra os nomes novos.</Rule>
            <p className="rule-paragraph">Escrita alternativa: <code>select</code>, <code>project</code> e <code>rename</code> no lugar dos símbolos. O <code>_</code> é opcional: <code>{'σ{depto=4}(R)'}</code> também vale.</p>
          </section>
          <section>
            <h3>Operadores binários</h3>
            <Rule title="∪ União" code="A ∪ B">Reúne as tuplas de A e de B, sem duplicatas. A e B devem ter os mesmos atributos.</Rule>
            <Rule title="− Diferença" code="A − B">Tuplas de A que não estão em B. Aceita <code>−</code> ou <code>-</code>. A e B devem ter os mesmos atributos.</Rule>
            <Rule title="∩ Interseção" code="A ∩ B">Tuplas que estão em A <em>e</em> em B. A e B devem ter os mesmos atributos. Equivale a <code>A − (A − B)</code>.</Rule>
            <Rule title="× Produto cartesiano" code="A × B">Combina cada tupla de A com cada tupla de B, inclusive pares sem relação entre si.</Rule>
            <Rule title="⨝ Junção natural" code="Empregado ⨝ Departamento">Combina só as tuplas com valores iguais em <em>todos</em> os atributos de mesmo nome; o atributo em comum aparece uma vez. Sem atributos em comum, vira um produto.</Rule>
            <Rule title="⨝ Junção theta" code="A ⨝_{A.id = B.id} B">Junta pela condição que você escrever. Equivale a <code>{'σ_{condição}(A × B)'}</code>.</Rule>
            <Rule title="÷ Divisão" code="Cursou ÷ Obrigatoria">Retorna os valores de A que aparecem combinados com <em>todas</em> as tuplas de B (“para todos”). Os atributos de B precisam existir em A.</Rule>
          </section>
          <section>
            <h3>Condições da seleção</h3>
            <ul className="rules-list">
              <li>Comparadores: <code>=</code> (ou <code>==</code>), <code>!=</code> (ou <code>{'<>'}</code>), <code>{'>'}</code>, <code>{'<'}</code>, <code>{'>='}</code>, <code>{'<='}</code>.</li>
              <li>O atributo fica à esquerda e o valor à direita: <code>{'salario>4000'}</code>, não <code>{'4000<salario'}</code>.</li>
              <li>Combine condições com vírgula, <code>and</code>, <code>e</code>, <code>&amp;&amp;</code> ou <code>∧</code>: <code>{'σ_{depto=4, salario>4000}(R)'}</code>. Todas precisam ser verdadeiras.</li>
              <li>Para <em>ou</em>, use <code>∨</code>, <code>or</code>, <code>ou</code> ou <code>||</code>: <code>{'σ_{depto=2 ∨ depto=4}(R)'}</code>. Basta uma ser verdadeira.</li>
              <li><em>E</em> tem prioridade sobre <em>ou</em>: <code>{'depto=4 ∧ salario>4000 ∨ depto=2'}</code> é lido como <code>{'(depto=4 ∧ salario>4000) ∨ depto=2'}</code>. Parênteses dentro da condição não são aceitos; para outra ordem, una duas seleções com <code>∪</code>.</li>
              <li>Não há negação (¬): use <code>!=</code> ou a diferença <code>−</code>.</li>
              <li>Textos podem ir entre aspas: <code>{"nomeE='Ana'"}</code>; com espaços, as aspas são obrigatórias: <code>{"nomeE='Ana Maria'"}</code>. A comparação ignora maiúsculas.</li>
              <li>Números são comparados como números: <code>{'salario>4000'}</code>.</li>
              <li>Do lado direito pode ir outra coluna: <code>{'σ_{Consulta.crm = Medico.crm}(Consulta × Medico)'}</code>. Um texto sem aspas que seja nome de coluna é lido como coluna.</li>
            </ul>
          </section>
          <section>
            <h3>Relações temporárias</h3>
            <Rule title="← Atribuição" code={<>{'T ← σ_{depto=4}(Empregado)'}<br />{'π_{nomeE}(T)'}</>}>Guarda um resultado com um nome para reutilizar depois. Escreva uma instrução por linha (<kbd>Enter</kbd>) ou separe com <code>;</code>. O resultado exibido é o da última instrução. Aceita <code>←</code>, <code>{'<-'}</code> ou <code>:=</code>.</Rule>
            <h3>Como encadear</h3>
            <div className="chain-example">
              <span>1</span><code>{'σ_{depto=4}(Empregado)'}</code><small>filtra as linhas</small>
              <span>2</span><code>{'π_{nomeE}(σ_{depto=4}(Empregado))'}</code><small>projeta o resultado da seleção</small>
            </div>
            <p className="rule-paragraph">A consulta mais interna é executada primeiro. O resultado de cada operação vira a relação de entrada da próxima.</p>
          </section>
          <section>
            <h3>Nomes</h3>
            <ul className="rules-list">
              <li>Relações: use o nome que aparece acima da tabela (<code>Empregado</code>). Maiúsculas não importam.</li>
              <li>Atributos: use o nome literal da coluna: <code>nomeE</code>, não <code>nome</code>. Maiúsculas e acentos não importam.</li>
              <li>Um nome criado com <code>ρ</code> ou <code>←</code> só existe nas instruções seguintes da mesma consulta. <code>T(a, b) ← …</code> também renomeia as colunas.</li>
              <li>Quando duas relações combinadas têm colunas com o mesmo nome, o resultado mostra <code>Relação.coluna</code> (como <code>Medico.nome</code>). Use esse nome completo para escolher qual delas.</li>
              <li>Com <code>{'ρ_{A}(R) ⨝_{…} ρ_{B}(R)'}</code> você junta uma relação com ela mesma (autojunção).</li>
            </ul>
          </section>
          <section>
            <h3>Erros comuns</h3>
            <ul className="rules-list">
              <li><code>{'π_{σ_{...}(R)}(R)'}</code> é inválido: dentro das chaves vão atributos ou condições, nunca outra consulta.</li>
              <li>Operadores binários são lidos da esquerda para a direita: <code>A − B − C</code> é <code>(A − B) − C</code>. Use parênteses para outra ordem.</li>
              <li>Projetar antes de selecionar remove o atributo da condição: <code>{'σ_{depto=4}(π_{nomeE}(R))'}</code> falha.</li>
              <li>Produto (×) no lugar de junção (⨝) gera combinações que não existem nos dados.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

// Summary panel + modal with the complete reference.
export default function Rules() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <section className="rules-panel panel" aria-labelledby="rules-title">
      <div className="panel-heading">
        <div><span className="panel-index">GUIA</span><h2 id="rules-title">Regras da linguagem</h2></div>
        <button className="open-rules" type="button" onClick={() => setOpen(true)}>Ver todas as regras <span>↗</span></button>
      </div>
      <div className="rules-grid">
        <div className="rule-card"><strong>Seleção σ</strong><code>{'σ_{condição}(Relação)'}</code><span>Filtra linhas usando o nome literal da coluna.</span></div>
        <div className="rule-card"><strong>Projeção π</strong><code>{'π_{atributo}(Relação)'}</code><span>Escolhe colunas literais.</span></div>
      </div>
      {open && <RulesModal onClose={close} />}
    </section>
  );
}
