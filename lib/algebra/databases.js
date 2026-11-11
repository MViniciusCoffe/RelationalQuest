// Playground databases. Each one is self-contained: tables share key names so
// natural joins work, and a few columns (like “nome”) repeat on purpose so the
// player has to rename (ρ) or qualify (Relacao.coluna) them.
const databases = [
  {
    code: 'HO',
    title: 'Hospital',
    description: 'Pacientes, médicos, consultas, internações e prescrições de um hospital.',
    tables: [
      { name: 'Paciente', columns: ['idPaciente', 'nome', 'nascimento', 'cidade', 'convenio'], rows: [
        [1, 'Ana Souza', '1985-04-12', 'Natal', 'Unimed'],
        [2, 'Bruno Alves', '2015-09-30', 'Mossoró', 'SUS'],
        [3, 'Carla Mendes', '1972-01-05', 'Natal', 'Bradesco'],
        [4, 'Diego Ramos', '1990-11-22', 'Parnamirim', 'SUS'],
        [5, 'Elisa Martins', '2018-06-14', 'Natal', 'Unimed'],
        [6, 'Fábio Teixeira', '1965-03-08', 'Caicó', 'Amil'],
        [7, 'Gabriela Pinto', '2001-12-01', 'Natal', 'SUS'],
        [8, 'Henrique Dias', '1958-07-19', 'Mossoró', 'Bradesco'],
      ] },
      { name: 'Medico', columns: ['crm', 'nome', 'idEspecialidade', 'salario', 'plantao'], rows: [
        [1201, 'Helena Costa', 1, 18500, 'noturno'],
        [1202, 'Rafael Lima', 2, 14200, 'diurno'],
        [1203, 'Marina Duarte', 3, 16800, 'diurno'],
        [1204, 'Paulo Freitas', 1, 17300, 'diurno'],
        [1205, 'Camila Rocha', 4, 12900, 'noturno'],
        [1206, 'Tiago Nunes', 5, 19100, 'diurno'],
      ] },
      { name: 'Especialidade', columns: ['idEspecialidade', 'especialidade'], rows: [
        [1, 'Cardiologia'], [2, 'Pediatria'], [3, 'Ortopedia'], [4, 'Dermatologia'], [5, 'Neurologia'],
      ] },
      { name: 'Consulta', columns: ['idConsulta', 'idPaciente', 'crm', 'data', 'valor'], rows: [
        [1, 1, 1201, '2024-02-03', 350],
        [2, 2, 1202, '2024-02-05', 0],
        [3, 3, 1201, '2024-02-10', 350],
        [4, 4, 1203, '2024-02-12', 0],
        [5, 5, 1202, '2024-02-15', 280],
        [6, 6, 1204, '2024-02-18', 400],
        [7, 1, 1205, '2024-03-01', 300],
        [8, 7, 1203, '2024-03-04', 0],
        [9, 8, 1206, '2024-03-07', 450],
        [10, 3, 1206, '2024-03-09', 450],
        [11, 6, 1201, '2024-03-12', 350],
        [12, 2, 1206, '2024-03-15', 0],
      ] },
      { name: 'Internacao', columns: ['idInternacao', 'idPaciente', 'quarto', 'entrada', 'alta'], rows: [
        [1, 6, 204, '2024-02-18', '2024-02-25'],
        [2, 4, 115, '2024-02-12', '2024-02-14'],
        [3, 8, 310, '2024-03-07', 'em aberto'],
        [4, 3, 204, '2024-03-09', '2024-03-12'],
      ] },
      { name: 'Prescricao', columns: ['idConsulta', 'medicamento', 'dose'], rows: [
        [1, 'Losartana', '50mg'], [3, 'Losartana', '50mg'], [3, 'AAS', '100mg'], [4, 'Ibuprofeno', '600mg'],
        [6, 'Atenolol', '25mg'], [7, 'Hidrocortisona', 'creme'], [9, 'Topiramato', '25mg'], [10, 'Topiramato', '50mg'], [11, 'AAS', '100mg'],
      ] },
    ],
    ideas: [
      ['Pacientes de Natal', "σ_{cidade='Natal'}(Paciente)"],
      ['Médicos e suas especialidades', 'π_{nome, especialidade}(Medico ⨝ Especialidade)'],
      ['Paciente × médico de cada consulta (renomeando “nome”)', 'P ← ρ_{paciente←nome}(Paciente)\nM ← ρ_{medico←nome}(Medico)\nπ_{paciente, medico, data}(P ⨝ Consulta ⨝ M)'],
      ['Pacientes que nunca foram internados', 'π_{idPaciente, nome}(Paciente) − π_{idPaciente, nome}(Paciente ⨝ Internacao)'],
      ['Médicos que atenderam todos os pacientes de Mossoró', "π_{crm, idPaciente}(Consulta) ÷ π_{idPaciente}(σ_{cidade='Mossoró'}(Paciente))"],
      ['Consultas caras com nomes qualificados', 'π_{Paciente.nome, Medico.nome, valor}(σ_{valor>=400}((Paciente ⨝ Consulta) ⨝_{Consulta.crm = Medico.crm} Medico))'],
    ],
  },
  {
    code: 'AC',
    title: 'Academia',
    description: 'Alunos, planos, instrutores, aulas, inscrições e avaliações físicas de uma academia.',
    tables: [
      { name: 'Plano', columns: ['idPlano', 'plano', 'mensalidade', 'piscina'], rows: [
        [1, 'Básico', 89, 'não'], [2, 'Plus', 129, 'sim'], [3, 'Premium', 189, 'sim'], [4, 'Estudante', 69, 'não'],
      ] },
      { name: 'Aluno', columns: ['idAluno', 'nome', 'idade', 'idPlano', 'inicio'], rows: [
        [1, 'Lucas Ferreira', 24, 2, '2023-01-10'],
        [2, 'Mariana Lopes', 31, 3, '2022-08-02'],
        [3, 'João Pedro', 19, 4, '2024-02-01'],
        [4, 'Beatriz Gomes', 45, 1, '2021-11-15'],
        [5, 'Rafael Souza', 28, 2, '2023-06-20'],
        [6, 'Larissa Melo', 22, 4, '2024-01-08'],
        [7, 'Carlos Eduardo', 52, 3, '2020-03-30'],
        [8, 'Juliana Prado', 36, 1, '2023-09-12'],
      ] },
      { name: 'Instrutor', columns: ['idInstrutor', 'nome', 'especialidade', 'turno'], rows: [
        [1, 'Fernanda Reis', 'Musculação', 'manhã'],
        [2, 'Gustavo Lima', 'Spinning', 'noite'],
        [3, 'Patrícia Alves', 'Natação', 'manhã'],
        [4, 'Rodrigo Santos', 'Funcional', 'tarde'],
        [5, 'Aline Barros', 'Yoga', 'noite'],
      ] },
      { name: 'Aula', columns: ['idAula', 'modalidade', 'idInstrutor', 'dia', 'horario', 'vagas'], rows: [
        [1, 'Spinning', 2, 'segunda', '19:00', 20],
        [2, 'Spinning', 2, 'quarta', '19:00', 20],
        [3, 'Natação', 3, 'terça', '07:00', 12],
        [4, 'Funcional', 4, 'quinta', '17:00', 15],
        [5, 'Yoga', 5, 'sexta', '20:00', 18],
        [6, 'Natação', 3, 'quinta', '07:00', 12],
      ] },
      { name: 'Inscricao', columns: ['idAluno', 'idAula'], rows: [
        [1, 1], [1, 2], [1, 4], [2, 3], [2, 5], [2, 6], [4, 5], [5, 1], [5, 2], [5, 4], [6, 4], [7, 3], [7, 6], [8, 5],
      ] },
      { name: 'Avaliacao', columns: ['idAluno', 'data', 'peso', 'gordura'], rows: [
        [1, '2024-01-10', 82.5, 18], [1, '2024-03-10', 80.1, 16.5], [2, '2024-02-01', 64, 24],
        [4, '2024-01-20', 71.3, 29], [5, '2024-02-15', 90.2, 22], [7, '2024-03-01', 77, 21],
      ] },
    ],
    ideas: [
      ['Alunos com acesso à piscina', "π_{nome, plano}(σ_{piscina='sim'}(Aluno ⨝ Plano))"],
      ['Grade de aulas com o instrutor', 'π_{modalidade, dia, horario, nome}(Aula ⨝ Instrutor)'],
      ['Alunos em todas as aulas de Spinning', "π_{nome}(Aluno ⨝ (Inscricao ÷ π_{idAula}(σ_{modalidade='Spinning'}(Aula))))"],
      ['Alunos sem nenhuma inscrição', 'π_{nome}(Aluno ⨝ (π_{idAluno}(Aluno) − π_{idAluno}(Inscricao)))'],
      ['Colegas na mesma aula (autojunção)', 'ρ_{A}(Inscricao) ⨝_{A.idAula = B.idAula ∧ A.idAluno < B.idAluno} ρ_{B}(Inscricao)'],
      ['Renomeando todas as colunas', 'ρ_{Ficha(aluno, anos, desde)}(π_{nome, idade, inicio}(Aluno))'],
    ],
  },
  {
    code: 'UN',
    title: 'Universidade',
    description: 'Estudantes, professores, departamentos, disciplinas, turmas e notas.',
    tables: [
      { name: 'Departamento', columns: ['idDepto', 'departamento', 'predio'], rows: [
        [1, 'Computação', 'Bloco A'], [2, 'Matemática', 'Bloco B'], [3, 'Física', 'Bloco C'],
      ] },
      { name: 'Professor', columns: ['idProfessor', 'nome', 'idDepto', 'titulacao'], rows: [
        [1, 'Ricardo Alves', 1, 'Doutorado'],
        [2, 'Sofia Martins', 1, 'Mestrado'],
        [3, 'Eduardo Nogueira', 2, 'Doutorado'],
        [4, 'Lívia Cardoso', 3, 'Doutorado'],
        [5, 'Marcos Vieira', 2, 'Mestrado'],
      ] },
      { name: 'Disciplina', columns: ['codigo', 'disciplina', 'creditos', 'idDepto'], rows: [
        ['BD1', 'Banco de Dados', 4, 1], ['ED', 'Estruturas de Dados', 4, 1], ['RC', 'Redes', 4, 1],
        ['CAL1', 'Cálculo I', 6, 2], ['ALG', 'Álgebra Linear', 4, 2], ['FIS1', 'Física I', 6, 3],
      ] },
      { name: 'Turma', columns: ['idTurma', 'codigo', 'idProfessor', 'semestre'], rows: [
        [1, 'BD1', 1, '2024.1'], [2, 'ED', 2, '2024.1'], [3, 'CAL1', 3, '2024.1'], [4, 'FIS1', 4, '2024.1'],
        [5, 'ALG', 5, '2024.1'], [6, 'BD1', 1, '2024.2'], [7, 'RC', 2, '2024.2'], [8, 'CAL1', 5, '2024.2'],
      ] },
      { name: 'Estudante', columns: ['matricula', 'nome', 'curso', 'ingresso'], rows: [
        [2021001, 'Ana Clara', 'Computação', 2021],
        [2021002, 'Bruno Henrique', 'Computação', 2021],
        [2022003, 'Camila Torres', 'Matemática', 2022],
        [2022004, 'Davi Moura', 'Física', 2022],
        [2023005, 'Eduarda Lins', 'Computação', 2023],
        [2023006, 'Felipe Araújo', 'Matemática', 2023],
      ] },
      { name: 'Cursa', columns: ['matricula', 'idTurma', 'nota'], rows: [
        [2021001, 1, 9.2], [2021001, 2, 8.7], [2021001, 7, 9.5], [2021001, 3, 7.1],
        [2021002, 1, 6.4], [2021002, 2, 5.8], [2021002, 8, 7.0],
        [2022003, 3, 9.8], [2022003, 5, 9.1],
        [2022004, 4, 8.3], [2022004, 3, 6.0],
        [2023005, 6, 7.7], [2023005, 2, 8.9],
        [2023006, 8, 4.5], [2023006, 5, 6.2],
      ] },
    ],
    ideas: [
      ['Notas acima de 9', 'π_{nome, disciplina, nota}(σ_{nota>9}(Estudante ⨝ Cursa ⨝ Turma ⨝ Disciplina))'],
      ['Professores e seus departamentos', 'π_{nome, departamento, titulacao}(Professor ⨝ Departamento)'],
      ['Quem cursou todas as disciplinas de Computação', 'Comp ← π_{codigo}(σ_{idDepto=1}(Disciplina))\nπ_{nome}(Estudante ⨝ (π_{matricula, codigo}(Cursa ⨝ Turma) ÷ Comp))'],
      ['Todas as pessoas da universidade', 'ρ_{Pessoa(nome)}(π_{nome}(Estudante) ∪ π_{nome}(Professor))'],
      ['Estudante e professor de cada turma', 'E ← ρ_{estudante←nome}(Estudante)\nP ← ρ_{professor←nome}(Professor)\nπ_{estudante, professor, codigo, semestre}(E ⨝ Cursa ⨝ Turma ⨝ P)'],
      ['Reprovações (nota < 6)', 'σ_{nota<6}(Cursa)'],
    ],
  },
  {
    code: 'BI',
    title: 'Biblioteca',
    description: 'Livros, autores, editoras, leitores e empréstimos de uma biblioteca de bairro.',
    tables: [
      { name: 'Editora', columns: ['idEditora', 'editora', 'cidade'], rows: [
        [1, 'Companhia das Letras', 'São Paulo'], [2, 'Rocco', 'Rio de Janeiro'], [3, 'Intrínseca', 'Rio de Janeiro'],
      ] },
      { name: 'Livro', columns: ['idLivro', 'titulo', 'ano', 'genero', 'idEditora'], rows: [
        [1, 'Dom Casmurro', 1899, 'Romance', 1],
        [2, 'Memórias Póstumas de Brás Cubas', 1881, 'Romance', 1],
        [3, 'A Hora da Estrela', 1977, 'Romance', 2],
        [4, 'Cem Anos de Solidão', 1967, 'Realismo mágico', 2],
        [5, 'Capitães da Areia', 1937, 'Romance', 1],
        [6, 'Americanah', 2013, 'Romance', 1],
        [7, 'Belas Maldições', 1990, 'Fantasia', 3],
        [8, 'Coraline', 2002, 'Fantasia', 3],
        [9, 'Deuses Americanos', 2001, 'Fantasia', 3],
      ] },
      { name: 'Autor', columns: ['idAutor', 'nome', 'pais'], rows: [
        [1, 'Machado de Assis', 'Brasil'], [2, 'Clarice Lispector', 'Brasil'], [3, 'Gabriel García Márquez', 'Colômbia'],
        [4, 'Jorge Amado', 'Brasil'], [5, 'Chimamanda Ngozi Adichie', 'Nigéria'], [6, 'Neil Gaiman', 'Reino Unido'], [7, 'Terry Pratchett', 'Reino Unido'],
      ] },
      { name: 'Escreve', columns: ['idLivro', 'idAutor'], rows: [
        [1, 1], [2, 1], [3, 2], [4, 3], [5, 4], [6, 5], [7, 6], [7, 7], [8, 6], [9, 6],
      ] },
      { name: 'Leitor', columns: ['idLeitor', 'nome', 'bairro'], rows: [
        [1, 'Paula Moreira', 'Centro'], [2, 'Igor Batista', 'Tirol'], [3, 'Renata Cunha', 'Ponta Negra'], [4, 'Sérgio Pacheco', 'Centro'], [5, 'Tânia Rezende', 'Lagoa Nova'],
      ] },
      { name: 'Emprestimo', columns: ['idEmprestimo', 'idLivro', 'idLeitor', 'retirada', 'devolucao'], rows: [
        [1, 1, 1, '2024-01-05', '2024-01-19'],
        [2, 3, 2, '2024-01-08', '2024-01-22'],
        [3, 7, 3, '2024-01-10', '2024-01-30'],
        [4, 8, 3, '2024-02-01', '2024-02-10'],
        [5, 9, 3, '2024-02-12', 'pendente'],
        [6, 4, 4, '2024-02-15', '2024-03-01'],
        [7, 2, 1, '2024-02-20', 'pendente'],
        [8, 1, 5, '2024-03-01', '2024-03-14'],
        [9, 6, 2, '2024-03-03', 'pendente'],
      ] },
    ],
    ideas: [
      ['Empréstimos ainda não devolvidos', "π_{titulo, nome, retirada}(σ_{devolucao='pendente'}(Emprestimo ⨝ Livro ⨝ Leitor))"],
      ['Autores brasileiros e seus livros', "π_{nome, titulo}(σ_{pais='Brasil'}(Autor) ⨝ Escreve ⨝ Livro)"],
      ['Livros com mais de um autor (autojunção)', 'ρ_{A}(Escreve) ⨝_{A.idLivro = B.idLivro ∧ A.idAutor < B.idAutor} ρ_{B}(Escreve)'],
      ['Quem leu todos os livros de Neil Gaiman', "Gaiman ← π_{idLivro}(σ_{nome='Neil Gaiman'}(Autor) ⨝ Escreve)\nπ_{nome}(Leitor ⨝ (π_{idLeitor, idLivro}(Emprestimo) ÷ Gaiman))"],
      ['Livros que nunca saíram da estante', 'π_{titulo}(Livro ⨝ (π_{idLivro}(Livro) − π_{idLivro}(Emprestimo)))'],
      ['Autor renomeado na visualização', 'π_{autor, titulo, ano}(ρ_{nome→autor}(Autor) ⨝ Escreve ⨝ Livro)'],
    ],
  },
  {
    code: 'LO',
    title: 'Loja virtual',
    description: 'Clientes, produtos, pedidos, itens e avaliações de um e-commerce.',
    tables: [
      { name: 'Cliente', columns: ['idCliente', 'nome', 'cidade', 'cadastro'], rows: [
        [1, 'Amanda Ribeiro', 'Natal', '2023-01-15'],
        [2, 'Bernardo Castro', 'Recife', '2023-03-02'],
        [3, 'Cecília Nunes', 'Natal', '2023-05-20'],
        [4, 'Daniel Farias', 'Fortaleza', '2023-07-11'],
        [5, 'Estela Moura', 'João Pessoa', '2024-01-09'],
        [6, 'Fernando Lira', 'Recife', '2024-02-14'],
      ] },
      { name: 'Produto', columns: ['idProduto', 'produto', 'categoria', 'preco', 'estoque'], rows: [
        [1, 'Notebook Aurora 14', 'Informática', 4299, 12],
        [2, 'Mouse sem fio', 'Informática', 89.9, 140],
        [3, 'Teclado mecânico', 'Informática', 349, 45],
        [4, 'Fone Bluetooth', 'Áudio', 259, 60],
        [5, 'Caixa de som', 'Áudio', 499, 25],
        [6, 'Cafeteira elétrica', 'Casa', 219, 30],
        [7, 'Air fryer', 'Casa', 549, 18],
        [8, 'Monitor 27 polegadas', 'Informática', 1399, 20],
      ] },
      { name: 'Pedido', columns: ['idPedido', 'idCliente', 'data', 'status'], rows: [
        [1, 1, '2024-03-01', 'entregue'], [2, 2, '2024-03-02', 'entregue'], [3, 1, '2024-03-10', 'enviado'], [4, 3, '2024-03-11', 'entregue'],
        [5, 4, '2024-03-15', 'cancelado'], [6, 5, '2024-03-18', 'processando'], [7, 2, '2024-03-20', 'enviado'], [8, 3, '2024-03-22', 'processando'],
      ] },
      { name: 'Item', columns: ['idPedido', 'idProduto', 'quantidade'], rows: [
        [1, 1, 1], [1, 2, 1], [2, 4, 2], [3, 7, 1], [4, 3, 1], [4, 2, 2], [4, 8, 1], [5, 5, 1], [6, 6, 1], [6, 4, 1], [7, 1, 1], [7, 8, 2], [8, 2, 1], [8, 1, 1],
      ] },
      { name: 'Avaliacao', columns: ['idCliente', 'idProduto', 'nota'], rows: [
        [1, 1, 5], [1, 2, 4], [2, 4, 3], [3, 3, 5], [3, 8, 4], [4, 5, 2], [2, 1, 4],
      ] },
    ],
    ideas: [
      ['Informática abaixo de R$ 500', "σ_{categoria='Informática' ∧ preco<500}(Produto)"],
      ['Itens do pedido 4 com preço', 'π_{produto, quantidade, preco}(σ_{idPedido=4}(Item ⨝ Produto))'],
      ['Clientes que nunca compraram', 'π_{nome}(Cliente ⨝ (π_{idCliente}(Cliente) − π_{idCliente}(Pedido)))'],
      ['Quem comprou todos os produtos de Informática', "π_{nome}(Cliente ⨝ (π_{idCliente, idProduto}(Pedido ⨝ Item) ÷ π_{idProduto}(σ_{categoria='Informática'}(Produto))))"],
      ['Avaliações extremas', 'π_{nome, produto, nota}(σ_{nota=5 ∨ nota<=2}(Cliente ⨝ Avaliacao ⨝ Produto))'],
      ['Pedido com colunas renomeadas', 'ρ_{Compra(pedido, cliente, quando, situacao)}(Pedido)'],
    ],
  },
];

export default databases;
