const Sybase = require('node-sybase-nu');
const jsonFile = require('jsonfile');

require('dotenv').config();

db = new Sybase([
    {
      name: 'main',
      host: 'localhost',
      port: process.env.PORT_SYBASE,
      dbname: process.env.DBNAME_SYBASE,
      username: process.env.USERNAME_SYBASE,
      password: process.env.PASSWORD_SYBASE,
      logging: true
    }
]);

const migration = {
    migrarAluno: false,
    migrarNotas: true
};

(async () => {
    
    if (migration.migrarAluno) {

        //Migra os alunos
        jsonFile.writeFile('./json/alunos.json', []);

        let top = 1000;
        let start = 1;
        let continuar = true;

        let count = 1

        while(continuar) {
            result = await db.DBPools.main.query(`
                select 
                    top ${top} 
                    start at ${start} 
                    i_alunos, 
                    nome, 
                    SUBSTR(dat_nascimento, 0, 10) as dat_nascimento
                from 
                    bethadba.alunos 
                where 
                    dat_nascimento is not null
            `);
            
            result.forEach(element => { 
                console.log(count);
                count += 1;

                element['nome'] = element.nome.replace('u009A', 'Ú');
                element['nome'] = element.nome.replace('u0094', 'Ô');
                element['nome'] = element.nome.replace('u0096', 'Ö');

                jsonFile.writeFile('./json/alunos.json', element, { spaces: 2, flag: 'a', finalEOL: false });   
            });  

            start += top; 

            if (result.length == 0) {
                continuar = false;
            }
        }

        jsonFile.writeFile('./json/alunos.json', [], { flag: 'a' });

    } 
    
    if (migration.migrarNotas) {

        //Migar as notas
        let caminho = './json/notas.json'

        jsonFile.writeFile(caminho, []);

        let top = 10000;
        let start = 1;
        let continuar = true;

        let count = 1

        while(continuar) {

            result = await db.DBPools.main.query(`
                select 
                    top ${top}
                    start at ${start}
                    md.i_alunos,
                    d.nome as disciplina_nome, 
                    d.sigla as disciplina_sigla, 
                    periodo_avaliativo = string(md.nro_nota,' TRIMESTRE'),          				
                    md.nota as nota_numerica,
                    md.ano_letivo,
                    descricao_turma = if s.descr_turma = '' 
                                        then 
                                            string(md.i_series, md.turma)
                                        else 
                                            descr_turma 
                                        endif,
                    string('[', md.i_cursos, '-', md.i_series, '] ', md.turma, ' - ', descricao_turma) as turma             
                from 
                    bethadba.matriculas_disciplinas md
                inner join 
                    bethadba.disciplinas d on (md.i_disciplinas = d.i_disciplinas)
                inner join 
                    bethadba.series s on (md.ano_letivo = s.ano_letivo and md.i_escolas = s.i_escolas and md.i_cursos = s.i_cursos and md.i_series = s.i_series and md.turma = s.turma)
                where  
                    md.nota is not null and 
                    md.texto_nota_descritiva is null and 
                    md.ano_letivo <= 2019 and
                    s.nota_conceito = 'N'
                order by 
                    md.i_alunos,
                    md.ano_letivo, 
                    md.i_disciplinas, 
                    md.nro_nota
            `);

            result.forEach(element => { 
                console.log(count);
                count += 1;

                //Foi encontrado um problema. Solução: 
                if (element.disciplina_sigla == 'ART') {
                    element['disciplina_sigla'] = 'ART.';    
                }

                jsonFile.writeFile(caminho, element, { spaces: 2, flag: 'a', finalEOL: false });   
            });  

            start += top; 
        
            if (result.length == 0) {
                continuar = false;
            }
        }

        jsonFile.writeFile(caminho, [], { flag: 'a' });

    }
})();