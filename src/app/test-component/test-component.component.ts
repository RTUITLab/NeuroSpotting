import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { KeywordSpottingService } from '../shared/keyword-spotting.service';

interface modelName {
  name: string;
  displayName: string;
}

@Component({
  selector: 'app-test-component',
  templateUrl: './test-component.component.html',
  styleUrls: ['./test-component.component.css'],
})
export class TestComponentComponent implements OnInit {
  falsePositive: Array<number>;
  prediction: Boolean;
  recording: Boolean;
  keyPhraseCounter: number;
  modelNames: modelName[];
  currentModelName: string;
  canBeDownloaded: Boolean;
  constructor(
    private audio: KeywordSpottingService,
    private changeDetectorRef: ChangeDetectorRef
  ) {
    this.falsePositive = null;
    this.canBeDownloaded = false;
    this.recording = false;
    this.prediction = false;
    this.keyPhraseCounter = 0;
    this.modelNames = [
      { name: 'mira', displayName: 'Мира' },
      { name: 'Dio', displayName: 'Дио' },
      { name: 'Itan', displayName: 'Итан' },
      { name: 'Jarvis', displayName: 'Джарвис' },
      { name: 'Lada', displayName: 'Лада' },
    ];
    this.currentModelName = this.modelNames[0].name;
  }

  ngOnInit(): void {
    this.prediction = false;
    this.audio.Init(this.currentModelName).subscribe((val: Boolean) => {
      if (this.prediction != val) {
        this.prediction = val;
        if (this.prediction) {
          // this.audio.Stop();
          this.keyPhraseCounter++;
          this.falsePositive = this.audio.GetKeywordAudio();
          this.canBeDownloaded = true;
        }
        this.changeDetectorRef.detectChanges();
      }
    });
    this.audio.GetRecordingState().subscribe((state: Boolean) => {
      this.recording = state;
      this.changeDetectorRef.detectChanges();
    });
  }

  Start(): void {
    this.audio.Record();
    this.prediction = false;
  }

  Stop(): void {
    this.audio.Stop();
  }

  Toggle(): void {
    if (this.recording) {
      this.Stop();
    } else {
      this.Start();
    }
  }

  ButtonAppearence() {
    let classes = {
      "recording-circle": this.recording === true,
      "notRecording-circle": this.recording === false,
    };
    return classes;
  }

  UpdateModelName(): void {
    this.audio.LoadModel(this.currentModelName);
    this.keyPhraseCounter = 0;
    this.falsePositive = null;
    this.canBeDownloaded = false;
    this.changeDetectorRef.detectChanges();
  }

  Download(): void {
    if (this.falsePositive === null){
      return;
    }
    let buffer = new ArrayBuffer(44 + this.falsePositive.length * 4);
    let view = new DataView(buffer);
    let writeUTFBytes = (view: DataView, offset: number, line: string) => {
      for (var i = 0; i < line.length; i++) {
          view.setUint8(offset + i, line.charCodeAt(i));
      }
    }
    // RIFF chunk descriptor
    writeUTFBytes(view, 0, 'RIFF');
    view.setUint32(4, 44 + this.falsePositive.length * 4, true);
    writeUTFBytes(view, 8, 'WAVE');
    // FMT sub-chunk
    writeUTFBytes(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // chunkSize
    view.setUint16(20, 3, true); // wFormatTag (float samples)
    view.setUint16(22, 1, true); // wChannels: mono (1 channel)
    view.setUint32(24, this.audio.audioCtx.sampleRate, true); // dwSamplesPerSec
    view.setUint32(28, this.audio.audioCtx.sampleRate * 4, true); // dwAvgBytesPerSec
    view.setUint16(32, 4, true); // wBlockAlign
    view.setUint16(34, 32, true); // wBitsPerSample
    // data sub-chunk
    writeUTFBytes(view, 36, 'data');
    view.setUint32(40, this.falsePositive.length * 2, true);

    // write the PCM samples
    var index = 44;
    for (var i = 0; i < this.falsePositive.length; i++) {
        view.setFloat32(index, this.falsePositive[i], true);
        index += 4;
    }

    let blob = new Blob([view], { type: 'audio/wav' });
    let url = URL.createObjectURL(blob);

    let downloader = document.getElementById("downloader");
    document.body.appendChild(downloader);
    downloader.setAttribute("href", url);
    downloader.setAttribute("download", this.currentModelName + "FalsePositive.wav");
    downloader.click();
    window.URL.revokeObjectURL(url);
    downloader.setAttribute("href", "");
  }
}
