import WazuhError from "./WazuhError";

export class ElasticError extends WazuhError {
  constructor(error: Error, message: string, code: number) {
    super(error,message, code);
  }

  handleError(){
    console.log('Show error');
  }
}
