
function gerarCnpj() {
  const numeros = Array.from(
    { length: 12 },
    () => Math.floor(Math.random() * 10)
  );

  function calcularDigito(base, pesos) {
    const soma = base.reduce(
      (total, numero, i) => total + numero * pesos[i],
      0
    );

    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  }

  numeros.push(
    calcularDigito(
      numeros,
      [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    )
  );

  numeros.push(
    calcularDigito(
      numeros,
      [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    )
  );

  return numeros.join('');
}

console.log('CNPJ para teste:', gerarCnpj());
