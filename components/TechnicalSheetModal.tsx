import React, { useState } from 'react';
import { X, BookOpen, Activity, AlertCircle, Clock, Database, Brain, Flame, Heart, Baby, User, BedDouble, FileText } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const TechnicalSheetModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'triagem' | 'internacao'>('internacao');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 print:hidden">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-800 text-white p-5 flex justify-between items-center shrink-0 rounded-t-lg">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="text-teal-400" /> Ficha Técnica do Sistema
          </h2>
          <button onClick={onClose} className="hover:bg-slate-700 p-1 rounded transition"><X size={24} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50">
            <button 
                onClick={() => setActiveTab('internacao')}
                className={`px-6 py-3 text-sm font-bold uppercase transition-colors ${activeTab === 'internacao' ? 'bg-white border-b-2 border-teal-600 text-teal-800' : 'text-slate-500 hover:text-slate-700'}`}
            >
                Pacientes Internados (NEWS)
            </button>
            <button 
                onClick={() => setActiveTab('triagem')}
                className={`px-6 py-3 text-sm font-bold uppercase transition-colors ${activeTab === 'triagem' ? 'bg-white border-b-2 border-rose-600 text-rose-800' : 'text-slate-500 hover:text-slate-700'}`}
            >
                Triagem (ESI + CTAS)
            </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-8 text-sm text-slate-700 custom-scrollbar">
          
          {/* --- ABA INTERNAÇÃO --- */}
          {activeTab === 'internacao' && (
            <div className="space-y-8 animate-fade-in">
                
                {/* 1. NEWS TABLE */}
                <section>
                    <h3 className="flex items-center gap-2 font-bold text-lg text-slate-900 mb-2">
                        <Activity size={20} className="text-teal-600"/> 1. ESCORE NEWS (NATIONAL EARLY WARNING SCORE) - HPM PC020
                    </h3>
                    <p className="mb-4 text-slate-600">
                        O cálculo de deterioração clínica segue a tabela adaptada para o protocolo institucional da Rede Medical. O sistema atribui pontuações de 0 a 3 para cada sinal vital.
                    </p>

                    <div className="overflow-x-auto border border-slate-300 rounded-lg shadow-sm">
                        <table className="w-full text-xs md:text-sm text-center border-collapse">
                            <thead>
                                <tr className="border-b border-slate-300">
                                    <th className="p-3 text-left font-bold text-slate-800 w-40 border-r border-slate-300 bg-slate-50">Parâmetro</th>
                                    <th className="p-3 font-bold text-slate-900 bg-red-100 w-24 border-r border-slate-200">3</th>
                                    <th className="p-3 font-bold text-slate-900 bg-orange-100 w-24 border-r border-slate-200">2</th>
                                    <th className="p-3 font-bold text-slate-900 bg-yellow-100 w-24 border-r border-slate-200">1</th>
                                    <th className="p-3 font-bold text-slate-900 bg-emerald-100 w-24 border-r border-slate-200">0</th>
                                    <th className="p-3 font-bold text-slate-900 bg-yellow-100 w-24 border-r border-slate-200">1</th>
                                    <th className="p-3 font-bold text-slate-900 bg-orange-100 w-24 border-r border-slate-200">2</th>
                                    <th className="p-3 font-bold text-slate-900 bg-red-100 w-24">3</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white text-slate-700">
                                <tr className="hover:bg-slate-50">
                                    <td className="p-2 text-left font-bold text-slate-800 border-r border-slate-200 bg-slate-50">Pressão Sistólica</td>
                                    <td className="p-2 border-r border-slate-100">&le; 90</td>
                                    <td className="p-2 border-r border-slate-100">91-100</td>
                                    <td className="p-2 border-r border-slate-100">101-110</td>
                                    <td className="p-2 border-r border-slate-100">111-219</td>
                                    <td className="p-2 border-r border-slate-100">-</td>
                                    <td className="p-2 border-r border-slate-100">-</td>
                                    <td className="p-2">&ge; 220</td>
                                </tr>
                                <tr className="hover:bg-slate-50">
                                    <td className="p-2 text-left font-bold text-slate-800 border-r border-slate-200 bg-slate-50">Freq. Cardíaca</td>
                                    <td className="p-2 border-r border-slate-100">&le; 40</td>
                                    <td className="p-2 border-r border-slate-100">41-50</td>
                                    <td className="p-2 border-r border-slate-100">51-90</td>
                                    <td className="p-2 border-r border-slate-100">91-110</td>
                                    <td className="p-2 border-r border-slate-100">111-130</td>
                                    <td className="p-2 border-r border-slate-100">-</td>
                                    <td className="p-2">&ge; 131</td>
                                </tr>
                                <tr className="hover:bg-slate-50">
                                    <td className="p-2 text-left font-bold text-slate-800 border-r border-slate-200 bg-slate-50">Freq. Respiratória</td>
                                    <td className="p-2 border-r border-slate-100">&le; 8</td>
                                    <td className="p-2 border-r border-slate-100">-</td>
                                    <td className="p-2 border-r border-slate-100">9-11</td>
                                    <td className="p-2 border-r border-slate-100">12-20</td>
                                    <td className="p-2 border-r border-slate-100">-</td>
                                    <td className="p-2 border-r border-slate-100">21-24</td>
                                    <td className="p-2">&ge; 25</td>
                                </tr>
                                <tr className="hover:bg-slate-50">
                                    <td className="p-2 text-left font-bold text-slate-800 border-r border-slate-200 bg-slate-50">Temperatura</td>
                                    <td className="p-2 border-r border-slate-100">&le; 35.0</td>
                                    <td className="p-2 border-r border-slate-100">-</td>
                                    <td className="p-2 border-r border-slate-100">35.1-36.0</td>
                                    <td className="p-2 border-r border-slate-100">36.1-38.0</td>
                                    <td className="p-2 border-r border-slate-100">38.1-39.0</td>
                                    <td className="p-2 border-r border-slate-100">&ge; 39.1</td>
                                    <td className="p-2">-</td>
                                </tr>
                                <tr className="hover:bg-slate-50">
                                    <td className="p-2 text-left font-bold text-slate-800 border-r border-slate-200 bg-slate-50">SpO2</td>
                                    <td className="p-2 border-r border-slate-100">&le; 91</td>
                                    <td className="p-2 border-r border-slate-100">92-93</td>
                                    <td className="p-2 border-r border-slate-100">94-95</td>
                                    <td className="p-2 border-r border-slate-100">&ge; 96</td>
                                    <td className="p-2 border-r border-slate-100" colSpan={3}>-</td>
                                </tr>
                                <tr className="hover:bg-slate-50">
                                    <td className="p-2 text-left font-bold text-slate-800 border-r border-slate-200 bg-slate-50">Consciência</td>
                                    <td className="p-2 border-r border-slate-100" colSpan={3}>-</td>
                                    <td className="p-2 border-r border-slate-100">Alerta</td>
                                    <td className="p-2 border-r border-slate-100">Confuso</td>
                                    <td className="p-2 border-r border-slate-100">Resp. Dor</td>
                                    <td className="p-2">Inconsciente</td>
                                </tr>
                                <tr className="hover:bg-slate-50">
                                    <td className="p-2 text-left font-bold text-slate-800 border-r border-slate-200 bg-slate-50">O2 Suplementar</td>
                                    <td className="p-2 border-r border-slate-100" colSpan={3}>-</td>
                                    <td className="p-2 border-r border-slate-100">Não</td>
                                    <td className="p-2 border-r border-slate-100">Sim</td>
                                    <td className="p-2 border-r border-slate-100">-</td>
                                    <td className="p-2">-</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-4 p-4 border border-rose-200 bg-rose-50 rounded-lg text-rose-900">
                        <strong>Interpretação:</strong> Pontuação &ge; 5 ou qualquer parâmetro individual com pontuação 3 gera o alerta de <span className="font-bold text-red-700 uppercase">POSSÍVEL DETERIORAÇÃO CLÍNICA</span>.
                    </div>
                </section>

                {/* 2. PROTOCOLOS */}
                <section>
                    <h3 className="flex items-center gap-2 font-bold text-lg text-slate-900 mb-4 border-b pb-2">
                        <Brain size={20} className="text-rose-600"/> 2. ALGORITMOS DE DETECÇÃO DE PROTOCOLOS
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* AVC */}
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <h4 className="font-bold text-slate-800 mb-2">2.1 Protocolo de AVC - HPM PC064</h4>
                            <p className="text-xs text-slate-500 mb-2">Detecção de Sinais Focais Agudos.</p>
                            <ul className="text-sm space-y-2 list-disc list-inside text-slate-700">
                                <li><strong>Lógica:</strong> Critério de Gatilho Único.</li>
                                <li><strong>Regra:</strong> A seleção de QUALQUER sintoma neurológico (ex: desvio de rima, paresia, alteração de fala, cefaleia súbita intensa) dispara o alerta imediatamente.</li>
                            </ul>
                        </div>

                        {/* DOR TORÁCICA */}
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <h4 className="font-bold text-slate-800 mb-2">2.2 Protocolo de Dor Torácica - HPM PC028</h4>
                            <p className="text-xs text-slate-500 mb-2">Estratificação de Risco para SCA.</p>
                            <ul className="text-sm space-y-1 text-slate-700">
                                <li><strong>Grupo A (Maiores):</strong> Dor típica, irradiação MMSS/Cervical.</li>
                                <li><strong>Grupo B (Condicionais):</strong> Dor epigástrica, dor dorsal.</li>
                                <li><strong>Grupo C (Associados):</strong> Dispneia, sudorese, náusea.</li>
                            </ul>
                            <div className="mt-2 text-xs font-bold bg-white p-2 border rounded">
                                Gatilho: (&ge;1 Grupo A) OU (&ge;1 Grupo B E &ge;1 Grupo C).
                            </div>
                        </div>
                    </div>

                    {/* SEPSE */}
                    <div className="mt-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
                         <h4 className="font-bold text-slate-800 mb-2">2.3 Protocolo de SEPSE - HPM PC027</h4>
                         <p className="text-xs text-slate-500 mb-2">Critérios de SIRS e Disfunção Orgânica.</p>
                         <div className="grid md:grid-cols-2 gap-4">
                             <div>
                                 <strong className="block text-xs uppercase mb-1">Definições:</strong>
                                 <ul className="text-sm space-y-1 list-disc list-inside text-slate-700">
                                     <li><strong>SIRS:</strong> Temp &ge; 37.8 ou &lt; 35; FC &gt; 90; FR &gt; 20.</li>
                                     <li><strong>Disfunção:</strong> PAS &lt; 90; SpO2 &lt; 94 ou O2 Supp; Alt. Consciência; Oligúria.</li>
                                 </ul>
                             </div>
                             <div>
                                 <strong className="block text-xs uppercase mb-1 text-rose-700">Gatilhos de Alerta:</strong>
                                 <ol className="text-sm space-y-1 list-decimal list-inside text-rose-800 font-medium">
                                     <li>Infecção Suspeita + (SIRS &ge; 2 OU Disfunção)</li>
                                     <li>SIRS &ge; 2 + Alteração de Consciência (Automático)</li>
                                     <li>SIRS &ge; 2 + O2 Suplementar (Automático)</li>
                                 </ol>
                             </div>
                         </div>
                    </div>

                    {/* DOR */}
                    <div className="mt-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <h4 className="font-bold text-slate-800 mb-2">2.4 Protocolo de Dor - HPM PC167</h4>
                        <ul className="text-sm space-y-2 list-disc list-inside text-slate-700">
                            <li><strong>Regra 1 (Intensidade):</strong> Escala Visual Analógica (EVA) &ge; 8.</li>
                            <li><strong>Regra 2 (Sinais Vitais):</strong> EVA = 7 <strong className="text-slate-900">ASSOCIADO A:</strong> PAS &gt; 150, PAD &gt; 95, SpO2 &lt; 94, FC &gt; 90 ou FR &gt; 22.</li>
                        </ul>
                    </div>
                </section>

                <section className="bg-slate-100 p-4 rounded border border-slate-200 flex items-start gap-3">
                    <Database size={24} className="text-slate-500 mt-1"/>
                    <div>
                        <h3 className="font-bold text-slate-800 text-sm uppercase">3. Integração de Dados</h3>
                        <p className="text-xs text-slate-600 mt-1">
                            O sistema não armazena dados locais sensíveis permanentemente. Todos os registros finalizados são transmitidos via API criptografada para o ambiente Google Workspace (Google Sheets) da instituição, garantindo rastreabilidade e backup em nuvem.
                        </p>
                    </div>
                </section>
            </div>
          )}

          {/* --- ABA TRIAGEM (CONTEÚDO ANTIGO) --- */}
          {activeTab === 'triagem' && (
            <div className="space-y-8 animate-fade-in">
              {/* 1. Níveis de Prioridade */}
              <section>
                <h3 className="flex items-center gap-2 font-bold text-lg text-slate-900 mb-4 border-b pb-2">
                  <Clock size={20} className="text-teal-600"/> 1. Níveis de Prioridade
                </h3>
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 text-xs uppercase tracking-wider">
                        <th className="p-3 border-b border-r font-bold text-center w-16">Nível</th>
                        <th className="p-3 border-b border-r font-bold w-32">Nome</th>
                        <th className="p-3 border-b border-r font-bold w-24 text-center">Cor</th>
                        <th className="p-3 border-b border-r font-bold w-24 text-center">Tempo Alvo</th>
                        <th className="p-3 border-b font-bold">Definição Resumida</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-700">
                      <tr className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 border-b border-r font-bold text-center text-lg">1</td>
                        <td className="p-3 border-b border-r font-bold">Ressuscitação</td>
                        <td className="p-3 border-b border-r bg-red-100 text-red-700 font-bold text-center border-red-200">Vermelho</td>
                        <td className="p-3 border-b border-r font-bold text-center">Imediato</td>
                        <td className="p-3 border-b">
                          <strong>Risco iminente de morte.</strong> Parada cardiorrespiratória, choque grave, intubação imediata, SpO2 &lt; 90%, inconsciência.
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 border-b border-r font-bold text-center text-lg">2</td>
                        <td className="p-3 border-b border-r font-bold">Emergência</td>
                        <td className="p-3 border-b border-r bg-orange-100 text-orange-700 font-bold text-center border-orange-200">Laranja</td>
                        <td className="p-3 border-b border-r font-bold text-center">&le; 10 min</td>
                        <td className="p-3 border-b">
                          <strong>Alto risco.</strong> Confusão mental aguda, dor severa (&ge; 7), dispneia, ou qualquer <strong>Discriminador CTAS</strong> positivo.
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 border-b border-r font-bold text-center text-lg">3</td>
                        <td className="p-3 border-b border-r font-bold">Urgência</td>
                        <td className="p-3 border-b border-r bg-yellow-100 text-yellow-700 font-bold text-center border-yellow-200">Amarelo</td>
                        <td className="p-3 border-b border-r font-bold text-center">&le; 30 min</td>
                        <td className="p-3 border-b">
                          Estável. Requer <strong>dois ou mais</strong> recursos (ex: Lab + Raio-X). Sinais vitais dentro dos limites aceitáveis.
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 border-b border-r font-bold text-center text-lg">4</td>
                        <td className="p-3 border-b border-r font-bold">Pouco Urgente</td>
                        <td className="p-3 border-b border-r bg-green-100 text-green-700 font-bold text-center border-green-200">Verde</td>
                        <td className="p-3 border-b border-r font-bold text-center">&le; 60 min</td>
                        <td className="p-3 border-b">
                          Estável. Requer apenas <strong>um recurso</strong> (ex: Raio-X, Sutura ou Medicação).
                        </td>
                      </tr>
                      <tr>
                        <td className="p-3 border-r font-bold text-center text-lg">5</td>
                        <td className="p-3 border-r font-bold">Não Urgente</td>
                        <td className="p-3 border-r bg-blue-100 text-blue-700 font-bold text-center border-blue-200">Azul</td>
                        <td className="p-3 border-r font-bold text-center">&le; 120 min</td>
                        <td className="p-3">
                          Estável. <strong>Nenhum recurso</strong> diagnóstico ou terapêutico diferenciado (apenas consulta, receita, atestado).
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* 2. Critérios Vitais */}
              <section>
                <h3 className="flex items-center gap-2 font-bold text-lg text-slate-900 mb-4 border-b pb-2">
                  <Activity size={20} className="text-rose-600"/> 2. Sinais Vitais Críticos (Critério de Upgrade para ESI 2)
                </h3>
                <div className="bg-rose-50 border border-rose-200 p-3 rounded-md mb-4 flex gap-3 items-start">
                  <AlertCircle className="text-rose-600 shrink-0 mt-0.5" size={18} />
                  <p className="text-sm text-rose-800">
                    <strong>Regra de Ouro:</strong> Se o paciente for inicialmente classificado como ESI 3, 4 ou 5, mas apresentar sinais vitais fora destes limites, ele deve ser automaticamente reclassificado para <strong>ESI 2 (Emergência)</strong>.
                  </p>
                </div>
                
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <User size={16} className="text-slate-500"/> Adultos (&ge; 18 Anos)
                    </h4>
                    <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-100 text-slate-700">
                          <tr>
                            <th className="p-2 text-left border-b font-bold">Parâmetro</th>
                            <th className="p-2 text-left border-b font-bold">Valor Crítico</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          <tr>
                            <td className="p-2 font-medium text-slate-600">Frequência Cardíaca</td>
                            <td className="p-2 font-bold text-rose-700">&gt; 130 ou &lt; 50 bpm</td>
                          </tr>
                          <tr>
                            <td className="p-2 font-medium text-slate-600">Frequência Respiratória</td>
                            <td className="p-2 font-bold text-rose-700">&gt; 30 ou &lt; 10 irpm</td>
                          </tr>
                          <tr>
                            <td className="p-2 font-medium text-slate-600">Saturação O2</td>
                            <td className="p-2 font-bold text-rose-700">&lt; 92%</td>
                          </tr>
                          <tr>
                            <td className="p-2 font-medium text-slate-600">PA Sistólica</td>
                            <td className="p-2 font-bold text-rose-700">&lt; 90 mmHg</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <Baby size={16} className="text-slate-500"/> Pediatria (Ajustado por Idade)
                    </h4>
                    <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-100 text-slate-700">
                          <tr>
                            <th className="p-2 text-left border-b font-bold">Idade</th>
                            <th className="p-2 text-left border-b font-bold">FC (bpm)</th>
                            <th className="p-2 text-left border-b font-bold">FR (irpm)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          <tr>
                            <td className="p-2 font-medium text-slate-600">Lactente (1-12 meses)</td>
                            <td className="p-2 font-bold text-rose-700">&gt; 160 ou &lt; 100</td>
                            <td className="p-2 font-bold text-rose-700">&gt; 50</td>
                          </tr>
                          <tr>
                            <td className="p-2 font-medium text-slate-600">Pré-escolar (1-3 anos)</td>
                            <td className="p-2 font-bold text-rose-700">&gt; 150 ou &lt; 90</td>
                            <td className="p-2 font-bold text-rose-700">&gt; 30</td>
                          </tr>
                          <tr>
                            <td className="p-2 font-medium text-slate-600">Escolar (6-12 anos)</td>
                            <td className="p-2 font-bold text-rose-700">&gt; 120 ou &lt; 70</td>
                            <td className="p-2 font-bold text-rose-700">&gt; 20</td>
                          </tr>
                          <tr>
                            <td className="p-2 font-medium text-slate-600">Adolescente (12-18 anos)</td>
                            <td className="p-2 font-bold text-rose-700">&gt; 130 ou &lt; 50</td>
                            <td className="p-2 font-bold text-rose-700">&gt; 30</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}

        </div>
        
        {/* Footer */}
        <div className="bg-slate-50 p-4 text-xs text-slate-500 rounded-b-lg border-t text-center flex justify-between items-center shrink-0">
           <span>Hospital São Mateus Cuiabá - Protocolo de Acolhimento</span>
           <span>Baseado em: ESI v4 + CTAS + NEWS</span>
        </div>
      </div>
    </div>
  );
};