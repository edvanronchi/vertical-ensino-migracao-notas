const { apiServiceLayer, apiFonteScript } = require('./service');
const delay = require('delay');

const alunosJson = require('./json/alunos.json');
const notasJson = require('./json/notas.json');

module.exports = {
    async consultarAlunoSybase({ alunoNome, dataNascimento }) {

        result = alunosJson.filter( i => i.nome == alunoNome && i.dat_nascimento == dataNascimento);

        if (result.length == 0) {
            return false;
        }

        return result;
    },

    async consutarNotasSybase({ idAluno, anoLetivo, turma }) {

        result = notasJson.filter( i => i.i_alunos == idAluno && i.ano_letivo == anoLetivo && i.turma == turma);

        if (result.length == 0) {
            return false;
        }

        return result;
    },

    //API Fonte de Script 
    async listarCloud(caminho, { filter, fields }) {
        let result = {
            hasNext: false
        };

        let offset = 0;
        let limit = 25;
        let hasNext = true;
        let arrayTotal = []

        while(hasNext) {
            await apiFonteScript.get('/'+ caminho, {                  
                params: {
                    offset,
                    limit,
                    filter,
                    fields
                }   
            }).then(function (response) {
                result = response.data

                result.content.forEach(i => {            
                    arrayTotal.push(i)
                });
            })
            .catch(function (error) {
                result.hasNext = false;
            })

            offset += limit

            hasNext = result.hasNext
        } 

        return arrayTotal
    },

    //API Service Layer 
    async inserirNota({ itemAvaliavelId, anoLetivoId, estabelecimentoId, enturmacaoId, nota }) {

        let data = [
            {            
                conteudo: {
                    itemAvaliavel: {
                        id: itemAvaliavelId
                    },
                    anoLetivo: {
                        id: anoLetivoId
                    },
                    estabelecimento: {
                        id: estabelecimentoId
                    },
                    modoAvaliacao: "NUMERICO",
                    enturmacao: {
                        id: enturmacaoId
                    },
                    notaNumerica: nota
                }
            }
        ];

        let result = await apiServiceLayer.post('/registro-avaliacao', data);

        await delay(1000);

        return result.data.id;
    },

    //API Service Layer 
    async atualizarNota({ id, nota }) {
        let data = [
            {     
                conteudo: {
                    id: id,
                    notaNumerica: nota
                }       
            }
        ];

        let result = await apiServiceLayer.post('/registro-avaliacao', data);

        return result.data.id;
    },

    calcularMedia(notas, m) {
        let exame = 0;
        let trimestre = 0;
        let isExame = false;
        let sigla = m.disciplina_sigla;

        const disciplinaNotas = notas.filter(element => element.disciplina_nome == m.disciplina_nome && element.disciplina_sigla == sigla);

        disciplinaNotas.forEach(i => {

            if (['1 TRIMESTRE', '2 TRIMESTRE', '3 TRIMESTRE'].includes(i.periodo_avaliativo)) {
                trimestre += i.nota_numerica;
            } else {
                exame = i.nota_numerica;
                isExame = true;
            }  
            
        });

        let mediaFinal = trimestre / 3;

        if (isExame) {
            mediaFinal = (mediaFinal + exame) / 2;
        } else {
            exame = null
        }

        let mediaFinalArrendondar = mediaFinal.toFixed(0);

        if ((mediaFinalArrendondar - mediaFinal) > 0.5) {
            mediaFinal = mediaFinalArrendondar + 1;
        } else {
            mediaFinal = mediaFinalArrendondar
        }

        return { mediaFinal, exame, sigla};
    }
}