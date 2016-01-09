'use strict';

module.exports = function(opts) {

  const filepath = opts.filepath ;
  const channels = opts.channels || 2 ;
  const sampleRate = opts.sampleRate || 44100 ;

  const mod = {

    loadWaveform: function(canvasWidth, timeStart, timeEnd) {

      const subSamplingMax = Math.floor(sampleRate/20);

      const totalSamplesRaw = (timeEnd - timeStart) / 1000 * sampleRate;
      const subSampling = Math.min(subSamplingMax, Math.ceil(totalSamplesRaw / canvasWidth));
      const totalSamplesSub = Math.floor(totalSamplesRaw / subSampling);

      const volTimeWindow = 100;  // ms

      const ret = {

        points: new Array(totalSamplesSub),

        optimalTimeSpan: canvasWidth / (sampleRate / subSampling),

        timeForIndex: function(index) {
          return index * subSampling / sampleRate * 1000 + timeStart;
        },

        indexForTime: function(time) {
          return (time - timeStart) / 1000 * sampleRate / subSampling;
        },

        getMinVolTime: function(start, end) {

          let index = undefined;
          let value = undefined;

          for (let i = this.indexForTime(start),
                   l = this.indexForTime(end); i<l; i++) {

            if (value === undefined || this.points[i] < value) {
              const i_scope = i;
              index = i_scope;
              value = this.points[i];
            }
          }

          return this.timeForIndex(index);
        },

        snapToMinVol: function(time) {

          return this.getMinVolTime(time - volTimeWindow, time + volTimeWindow);
        },

      };

      const readable = require('pcm-extract').getStream({
        filepath   : filepath   ,
        channels   : channels   ,
        sampleRate : sampleRate ,
        start      : timeStart  ,
        end        : timeEnd    ,
        init : function() {
          // keeps track of current channel
          this.channel = 0;
          // digital filter (2 channel)
          this.lastOut = [];
          // subsampling
          this.count = (new Array(channels)).map(function(){return 0});
        },
        processSample : function(sample) {
          // get current channel
          this.channel = this.channel===1?0:1;
          // take absolute value
          sample = Math.abs(sample);
          // low pass filter @~20Hz
          // https://en.wikipedia.org/wiki/Low-pass_filter#Discrete-time_realization
          if (this.lastOut[this.channel] === undefined) {
            this.lastOut[this.channel] = sample;
          } else {
            const a = 0.001;
            sample = this.lastOut[this.channel] += a * (sample - this.lastOut[this.channel]);
          }
          // subsample
          this.count += 1;
          if (this.count < subSampling * channels) {
            return;
          }
          this.count = 0;
          // average value on both channels
          this.push(this.lastOut.reduce(function(a,b){return a+b})/this.lastOut);
        }
      });

      readable.on('readable', function() {
        const data = readable.read();
        if (data !== null) ret.points.push(data);
        else if (callback) callback();
      });

      return ret;
    },
  };

  return mod;

};
