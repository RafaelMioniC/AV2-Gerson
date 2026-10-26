import { PapelUsuario } from "../enums/PapelUsuario";

export interface DadosCredencial {
  id: string;
  usuario: string;
  senhaHash: string;
  salt: string;
  papel: PapelUsuario;
  ultimoAcesso: string;
}
