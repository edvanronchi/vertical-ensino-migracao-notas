const jsonFile = require('jsonfile');
const delay = require('delay');

const { listarCloud, consultarAlunoSybase, consutarNotasSybase, calcularMedia, inserirNota, atualizarNota } = require('./src/functions');

//Parametros globais
const paramAtualizarNota = false;

const paramFilterEnturmacao = {
    filter: "matricula.aluno.id = 4959831",
    status: false
};

//Função principal
async function main({ diciplinaEquivalenteId, peridoAvaliativo, tipoPeriodo, turmaId, enturmacaoId, anoLetivoId, estabelecimentoId, nota}) {
    await delay(250);

    let log = '';

    if (peridoAvaliativo == '5 TRIMESTRE') {
        return true;
    }
    
    criterioPeriodoAvaliativo = `periodoAvaliativo.descricao = '${peridoAvaliativo}'`;
    if (!peridoAvaliativo) {
        criterioPeriodoAvaliativo = 'periodoAvaliativo.descricao is null';
    }

    let parametrosItemAvaliacao = {
        filter: `turma.id = ${turmaId} and itemEducacional.id = ${diciplinaEquivalenteId} and ${criterioPeriodoAvaliativo} and tipoPeriodo = '${tipoPeriodo}'`,
        fields: "itemEducacional(id, descricao), turma(id, descricao), periodoAvaliativo(id, descricao)"
    };

    //Busca o vinculo entre a disciplina, turma, periodo avaliativo
    let itemAvaliacao = await listarCloud('item-avaliacao-turma', parametrosItemAvaliacao);

    if (itemAvaliacao.length == 0) {
        console.log("Nenhum item avaliação encontrado!");

        return true; 
    }

    let itemAvaliavelId = itemAvaliacao[0].id;

    let parametrosMediaTrimestre = {
        filter: `enturmacao.id = ${enturmacaoId} and itemAvaliavel.id = ${itemAvaliavelId}`,
        fields: "itemAvaliavel(id), notaNumerica, enturmacao(id)"  
    }

    //Verifica no Cloud se o aluno já tem nota cadastrada
    let mediaTrimestre = await listarCloud('registro-avaliacao', parametrosMediaTrimestre);

    //Se não tiver registro de avaliação cria, caso tenha atualiza
    if (mediaTrimestre.length == 0) {
        let result = await inserirNota({ itemAvaliavelId, anoLetivoId, estabelecimentoId, enturmacaoId, nota });

        log = `Inserir nota ${tipoPeriodo} - ${result} - ${itemAvaliavelId} - ${anoLetivoId} - ${estabelecimentoId} - ${enturmacaoId} - ${nota}`; 

    } else if (mediaTrimestre.length > 0 && paramAtualizarNota){
        let id = mediaTrimestre[0].id;

        let result = await atualizarNota({ id, nota });  

        log = `Atualizar nota ${tipoPeriodo} - ${result} - ${id} - ${nota}`;                    
    }

    if (log) {
        console.log(log);
        jsonFile.writeFile('./src/logs/log-id.log', log, { flag: 'a' });
    }
}

(async () => {
    const data = new Date();

    jsonFile.writeFile('./src/logs/log-id.log', "------------------- " + data + " -------------------", { flag: 'a' });

    //Criterios e campos
    let filter = "anoLetivo.ano <= 2019";

    if (paramFilterEnturmacao.status) {
        filter = paramFilterEnturmacao.filter;
    }

    const parametrosEnturmacao = {
        filter,
        fields: "id, estabelecimento(id), turma(id, descricao, configuracaoAvaliacao(id)), anoLetivo(id, ano), matricula(aluno(identificacaoInep, pessoa(nome, fisica(dataNascimento, cpf))))"
    };

    //Busca todas as entumações no Cloud
    const enturmacoesCloud = await listarCloud('enturmacao', parametrosEnturmacao);

    //Ordena por ano
    const enturmacoesCloudSort= enturmacoesCloud.sort(function(a,b) {
        return a.anoLetivo.ano > b.anoLetivo.ano ? -1 : a.anoLetivo.ano < b.anoLetivo.ano ? 1 : 0;
    });

    //Percorre as entumações do Cloud
    enturmacoesCloudSort.forEach(async function(i, j) {

        //Declarando variaveis
        let alunoNome = i.matricula.aluno.pessoa.nome;
        let dataNascimento = i.matricula.aluno.pessoa.fisica.dataNascimento;
        let anoLetivo = i.anoLetivo.ano;
        let anoLetivoId = i.anoLetivo.id;
        let turma = i.turma.descricao;
        let estabelecimentoId = i.estabelecimento.id;
        let enturmacaoId = i.id;
        let turmaId = i.turma.id;
        
        let parametrosDisciplina = {
            filter: `itemEducacional.turmaPai.id = ${turmaId}`,
            fields: "itemEducacional(id, descricao, turmaPai(id)), etapaMatrizDisciplina(disciplina(sigla))"
        }
        
        //Busca todas as disciplinas vinculado a turma no Cloud
        const disciplinasCloud = await listarCloud('turma-disciplina', parametrosDisciplina);

        //Pega o id no Educação Desktop referente ao nome do aluno e data de nascimento
        let alunoId = await consultarAlunoSybase({ alunoNome, dataNascimento });

        if (!alunoId) {
            console.log(`Aluno não encontrado! => ${alunoNome} ${dataNascimento}`);

            return true
        }

        //Percorre o(s) id('s) 
        alunoId.forEach(async function(k, l) {
            let disciplinasCalculadas = [];

            //Busca todas as notas do Educação Desktop passando como paramentro o id, ano letivo e descrição da turma 
            let notas = await consutarNotasSybase({ idAluno: k.i_alunos, anoLetivo, turma });

            if (!notas) {
                console.log(`Nenhuma nota foi encontrada para esse aluno! => ${k.i_alunos}`);

                return true; 
            }

            //Percorre as notas 
            notas.forEach(async function(m, n) {
                let nota = m.nota_numerica;
                let sigla = m.disciplina_sigla;
                let peridoAvaliativo = m.periodo_avaliativo;

                //Busca a disciplina equivalente do Cloud
                let diciplinaEquivalente = await disciplinasCloud.filter(element => element.etapaMatrizDisciplina.disciplina.sigla == sigla)[0];

                if (!diciplinaEquivalente) {
                    console.log(`Nenhuma disciplina equivalente foi encontrada! => ${sigla}`);

                    return true; 
                }

                //Calcula, inseri, atualiza exame e media final
                if (!disciplinasCalculadas.includes(sigla)) {
                    let { exame, mediaFinal } = calcularMedia(notas, m);

                    disciplinasCalculadas.push(sigla);

                    if (exame !== null) {
                        await main (
                            { 
                                diciplinaEquivalenteId: diciplinaEquivalente.id, 
                                peridoAvaliativo: null, 
                                tipoPeriodo: 'EXAME_FINAL', 
                                turmaId, 
                                enturmacaoId,
                                anoLetivoId, 
                                estabelecimentoId, 
                                nota: exame
                            }
                        );
                    }

                    await main (
                        { 
                            diciplinaEquivalenteId: diciplinaEquivalente.id, 
                            peridoAvaliativo: null, 
                            tipoPeriodo: 'MEDIA_FINAL', 
                            turmaId, 
                            enturmacaoId,
                            anoLetivoId, 
                            estabelecimentoId, 
                            nota: mediaFinal
                        }
                    );
                }

                await main (
                    { 
                        diciplinaEquivalenteId: diciplinaEquivalente.id, 
                        peridoAvaliativo, 
                        tipoPeriodo: 'MEDIA_PERIODO', 
                        turmaId, 
                        enturmacaoId,
                        anoLetivoId, 
                        estabelecimentoId, 
                        nota
                    }
                );
            });
        });
    });
})();