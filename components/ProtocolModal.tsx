import React from 'react';
import { ProtocolDefinition } from '../types';
import { X, CheckSquare, Square } from 'lucide-react';

interface Props {
  protocol: ProtocolDefinition;
  isOpen: boolean;
  onClose: () => void;
  selectedCriteria: string[];
  onToggleCriteria: (criteria: string) => void;
}

export const ProtocolModal: React.FC<Props> = ({ 
  protocol, 
  isOpen, 
  onClose, 
  selectedCriteria, 
  onToggleCriteria 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-rose-700 text-white p-4 flex justify-between items-center">
          <h3 className="text-lg font-bold flex items-center gap-2">
             Critérios de Abertura: {protocol.name}
          </h3>
          <button onClick={onClose} className="hover:bg-rose-600 p-1 rounded">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1">
          <p className="mb-4 text-sm text-gray-600">Selecione os sinais e sintomas presentes:</p>
          <div className="space-y-3">
            {protocol.criteria.map((item, idx) => {
              const isSelected = selectedCriteria.includes(item);
              return (
                <div 
                  key={idx} 
                  className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${isSelected ? 'bg-rose-50 border-rose-300' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}
                  onClick={() => onToggleCriteria(item)}
                >
                  <div className={`mt-0.5 ${isSelected ? 'text-rose-600' : 'text-gray-400'}`}>
                    {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                  </div>
                  <span className={`text-sm ${isSelected ? 'font-medium text-gray-900' : 'text-gray-700'}`}>{item}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 font-medium transition-colors"
          >
            Confirmar e Fechar
          </button>
        </div>
      </div>
    </div>
  );
};