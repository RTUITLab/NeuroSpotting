import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { PreprocessorService } from './preprocessor.service';
import * as Fili from 'fili';

@Injectable({
  providedIn: 'root',
})
export class AudioService {
  private listening: BehaviorSubject<Boolean>;
  private audioCtx: AudioContext;
  private microphone: MediaStreamAudioSourceNode;
  private preprocessor: PreprocessorService;
  private recorder: AudioWorkletNode;
  constructor() {}

  public Init(): BehaviorSubject<Boolean> {
    this.audioCtx = new AudioContext();
    this.preprocessor = new PreprocessorService(2, 0.2, this.audioCtx);
    this._CreateRecorderWorklet(0.2);
    this.listening = new BehaviorSubject<Boolean>(false);
    return this.listening;
  }

  private _CreateRecorderWorklet(windowLen: number) {
    this.audioCtx.audioWorklet
      .addModule('../assets/recorder-worklet.js')
      .then(() => {
        this.recorder = new AudioWorkletNode(this.audioCtx, 'recorder', {
          processorOptions: {
            bufferLen: windowLen * this.audioCtx.sampleRate,
          },
        });
        this.recorder.port.onmessage = (event) => {
          if (event.data.eventType == 'audioData') {
            const audioData = event.data.audioPCM;
            this.preprocessor.appendData(audioData);
            if (this.preprocessor.bufferIsReady()) {
              console.log(this.preprocessor.process());
            }
          }
        };
      })
      .catch((e) => {
        console.log('Could not load because of: ' + e);
      });
  }

  public Record(): void {
    let callback = function (stream) {
      this.audioCtx.resume();
      this.microphone = this.audioCtx.createMediaStreamSource(stream);
      this.microphone.connect(this.recorder);
      this.recorder.connect(this.audioCtx.destination);
    }.bind(this);
    this.listening.next(true);
    navigator.getUserMedia(
      { video: false, audio: true },
      callback,
      console.log
    );
  }

  public Stop(): void {
    this.microphone.disconnect(this.recorder);
    this.recorder.disconnect(this.audioCtx.destination);
    this.audioCtx.suspend();
    this.listening.next(false);
  }
}
