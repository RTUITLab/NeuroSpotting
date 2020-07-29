import * as Fili from 'fili';
import { BufferPCM } from './buffer-pcm';
import { coeffs } from './coeffs';

export class Preprocessor {
  buffer: BufferPCM;
  n_parts: number;
  static firCalculator = new Fili.FirCoeffs();
  static firFilltersCoeffs;
  static firFilter;

  constructor(bufferLen: number, partLen: number, audioCtx: AudioContext) {
    this.buffer = new BufferPCM(
      bufferLen * audioCtx.sampleRate,
      audioCtx
    );
    this.n_parts = bufferLen / partLen;
  }

  static mean(arr: number[]): number{
    let sum = arr.reduce((accumulator: number, currentValue: number): number => {return accumulator + currentValue});
    return sum / arr.length;
  }

  static std(arr: number[], ddof: number): number{
    let mean = Preprocessor.mean(arr);
    let squaredDifference = arr.reduce((accumulator: number, currentValue: number): number => {return accumulator + (currentValue - mean)  * (currentValue - mean)});
    return  Math.sqrt(squaredDifference / (arr.length - ddof));
  }

  static initFirFilter({ order = 999, Fs, F1 = 260, F2 = 700 }): void {
    // Preprocessor.firFilltersCoeffs = Preprocessor.firCalculator.bandpass(
    //   {
    //     order: order,
    //     Fs: Fs,
    //     F1: F1,
    //     F2: F2,
    //   }
    // );
    Preprocessor.firFilltersCoeffs = coeffs.coeffs;
    Preprocessor.firFilter = new Fili.FirFilter(
      Preprocessor.firFilltersCoeffs
    );
  }

  appendData(data: Float32Array): void {
    this.buffer.Append(data);
  }

  clearBuffer(): void {
    this.buffer.Clear();
  }

  bufferIsReady(): Boolean {
    return this.buffer.IsReady();
  }

  static formantFiltering(PCMdata: number[]): number[] {
    return this.firFilter.multiStep(PCMdata);
  }

  static squareNormalize(array: number[]): number[]{
    let max = Math.max(...array);
    max = max * max;
    return array.map((currentValue: number): number => {return currentValue * currentValue / max});
  }

  static split(array: number[], n_parts: number): number[][] {
    let splited_arrays = new Array(n_parts);
    var part_len = ~~(array.length / n_parts);
    var add_length = array.length % n_parts;
    let i: number,
      j: number,
      k: number = 0;
    for (i = 0, j = array.length; i < j; i += part_len) {
      if (k < add_length) {
        splited_arrays[k] = array.slice(i, i + part_len + 1);
        i++;
      } else {
        splited_arrays[k] = array.slice(i, i + part_len);
      }
      k++;
    }
    return splited_arrays;
  }

  static integrate(arrays: number[][]): number[] {
    let e_parts: number[] = Array(arrays.length);
    for (let i = 0; i < arrays.length; i++) {
      const part = arrays[i];
      e_parts[i] = part.reduce((accumulator: number, currentValue: number): number => {return accumulator + currentValue;});
      e_parts[i] -= (part[0] + part[part.length - 1]) / 2;
    }
    return e_parts;
  }

  process(): number[] {
    console.time("filtering");
    let filtered = Preprocessor.formantFiltering(this.buffer.GetBuffer());
    console.timeEnd("filtering");
    let energies = Preprocessor.integrate(
      Preprocessor.split(
        Preprocessor.squareNormalize( filtered
        ),
        this.n_parts
      )
    );
    let std = Preprocessor.std(energies, 1);
    let mean = Preprocessor.mean(energies);
    return energies.map((currentValue: number): number => {return (currentValue - mean) / std});
  }
}