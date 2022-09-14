<template lang='pug'>
q-page
  .q-pa-md
    .q-gutter-y-md
      q-card
        q-card-section
          q-tabs(v-model='tab' dense='' align='left' narrow-indicator='')
            q-tab(name='Images' label='Quick Prompt')
          q-separator
          //- Images tab
          q-tab-panels(v-model='tab' animated='')
            q-tab-panel(name='Images')
              //- @todo Add random placeholders
              q-input(v-model='prompt' label='Prompt' placeholder='a dr seuss illustration of robots building a city' autogrow @change='autosave')
                template(v-slot:append='')
                  q-btn(color='primary' label='Dream' icon='bubble_chart' :disabled='isWakingUp' @click='queueDream')
                    //- q-tooltip(v-if='!settings.server || !settings.server.length' content-class='bg-red' content-style='font-size: 1em')
                    //-   | No servers selected
                  q-btn(v-if='isDreaming || isWakingUp' :disabled='isWakingUp' :loading='isWakingUp' color='negative' label='Stop' icon='cancel' @click='stopDreaming')
              template(v-for='server in settings.servers')
                q-linear-progress.q-mt-md(size='20px' v-if='server.isDreaming || server.isWakingUp' :value='server.dreamProgress' stripe='')
                  span(style='position: absolute; width: 100%; text-align: center; color: #fff; display: block; font-size: .65em') {{server.base}}
  .q-pa-md
    .q-col-gutter-md.row.items-start
      //- Config
      .col-4
        q-card
          q-card-section
            //- Basics
            q-badge Steps: {{ steps }} 
            q-slider(v-model='steps' :min='1' :max='150' :step='1' @change='autosave')
            q-badge Width: {{ width }} 
            q-slider(v-model='width' :min='64' :max='2048' :step='64' @change='autosave' snap='')
            q-badge Height: {{ height }} 
            q-slider(v-model='height' :min='64' :max='2048' :step='64' @change='autosave' snap='')
            //- Batches
            q-badge Batch Size: {{ batchSize }} 
            q-input(dense='' type='number' min='1' v-model.number='batchSize' @change='autosave')
      //- Gallery
      .col-8
        .q-col-gutter-md.row.items-start
          .col-4(v-for='(img, key) in imgs' :key='key')
            q-card.cursor-pointer(@click='expandImage(img)')
              q-card-section.q-pa-sm
                q-img(:src='img')
  //- Image Modal
  q-dialog(v-model='imageModal')
    q-card.my-card(style='min-width: 300px')
      q-img(:src='imageModalActiveImage' style='height: 300px')
      q-card-section
</template>



<script>
import axios from 'axios'
import {mapState} from 'vuex'
import store from 'store'

const autosaveFields = ['tab', 'prompt', 'sessionHash', 'imgs', 'width', 'height', 'steps', 'batchSize']

/**
 * Converts data into a format for specific Stable Diffusion apis
 */
const sdDataScribe = function (context) {
  let data, promptDictionary, defaults

  // Select statement based on data api
  if (true) {
    data = []
    promptDictionary = ['prompt', 'negative', '', 'steps', '', '', '', 'numBatches', 'batchSize', '', '', '', '', '', '', 'height', 'width', '', '', '', '', '', '', '', '']
    defaults = [context.defaultPrompt, '', 'None', 40, 'Euler a', false, false, context.numBatches, context.batchSize, 7, -1, -1, 0, 0, 0, context.height, context.width, 'None', null, 'Seed', '', 'Steps', '', false, []]
    console.log('defaults', defaults)
  
    // Build the data fro the given dictionary and defaults
    promptDictionary.forEach((key, n) => {
      console.log(key)
      if (key) {
        data.push(context[key] || defaults[n])
      } else {
        data.push(defaults[n])
      }
    })
  }

  
  return data
}

export default {
  name: 'IndexPage',

  computed: {
    ...mapState(['settings']),

    isDreaming: function () {
      return this.settings.servers.some(server => server.isDreaming)
    },

    isWakingUp: function () {
      return this.settings.servers.some(server => server.isWakingUp)
    },
  },

  mounted () {
    // Handle autosave fields
    const $onloadData = store.get('txt2Img') || {}
    autosaveFields.forEach(key => {
      // Load settings
      if ($onloadData.hasOwnProperty(key)) {
        this[key] = $onloadData[key]
      }

      // Add autosave watchers
      this.$watch(key, this.autosave, {deep: true})
    })
  },

  data: () => ({
    queue: [],
    curDream: {},
    tab: 'Images',
    prompt: '',
    negative: '',
    
    // @todo add this to config
    defaultPrompt: 'a dr seuss illustration of robots building a city',
    // @todo generate and persist this (and do we even need this?)
    sessionHash: '3exs9au2lti',

    imgs: [],
    width: 512,
    height: 512,
    steps: 40,

    dreamCheckInterval: 750, // milliseconds

    numBatches: 1,
    batchSize: 1,

    imageModal: false,
    imageModalActiveImage: null,
  }),
  
  methods: {
    /**
     * Queues up the dream and runs them if able to
     */
    queueDream () {
      // Exit if no servers
      if (!this.settings.servers.length) {
        this.$q.notify({
          message: 'No servers selected. Set one in Settings',
          position: 'top',
          color: 'red'
        })
        return
      }

      // Create the batch
      const batch = []
      for (let i = 0; i < this.batchSize; i++) {
        // Remove extra fields
        const data = Object.assign({}, this.txt2Img)
        delete data.queue
        batch.push(data)
      }
      this.queue.push(...batch)

      // Check and start the next dream
      this.settings.servers.forEach(server => {
        if (!server.isChecking) {
          // Loop through each server and try to find an available one to run
          const api = axios.create({ baseURL: server.base })

          server.isChecking = true
          this.checkDream(server, api)
        }
      })
    },

    /**
     * Check dream
     */
    checkDream (server, api) {
      console.log('checkDream', server)
      
      api
      .post('/api/predict', {
        fn_index: 4,
        data: [],
        session_hash: this.sessionHash,
      })
      .then((response) => {
        const data = response.data.data[0]
        server.lastResponse = data

        // If we're dreaming, update the progress
        // @todo handle multiple dreams
        if (data.isGenerating) {
          // Create a dummy DOM to extract the progress
          const $dom = document.createElement('div')
          $dom.innerHTML = data
          const $width = $dom.querySelector('.progress')

          // Update progress in UI
          if ($width?.innerHTML) {
            server.dreamProgress = parseInt($width.innerHTML.replace('%', '')) / 100
          } else {
            server.dreamProgress = 0
          }

          // Check the dream again
          if (server.isDreaming) {
            setTimeout(() => {
              this.checkDream(server, api)
            }, this.dreamCheckInterval)
          }

        // Otherwise start dreaming
        } else {
          !server.isDreaming && this.startDream(server, api)
        }
      })
      .catch(err => {
        this.$q.notify({
          color: 'negative',
          position: 'top',
          message: `Error checking dream: ${err}`,
          icon: 'report_problem',
        })
      })
    },

    /**
     * Starts the dream and occasionally checks in to update progress
     */
    startDream (server, api) {
      server.isDreaming = true
      server.progress = 0
      
      this.$nextTick(() => {
        this.$forceUpdate()

        setTimeout(() => {
          this.checkDream(server, api)
        }, 0)
      })

      api
        .post('/api/predict', {
          fn_index: 3,
          data: sdDataScribe(this),
          session_hash: this.sessionHash,
        })
        .then((response) => {
          // Clean data
          const data = []
          response.data.data.forEach((val) => {
            data.push(val)
          })

          const imgs = []
          data[0].forEach((img) => {
            imgs.push(img)
          })

          this.imgs.push(...imgs)

          // Run next in queue
          server.isDreaming = false
          server.isWakingUp = false
        })
        .catch((err) => {
          console.log('CATCH', err)
          this.$q.notify({
            color: 'negative',
            position: 'top',
            message: `Prompting failed: ${err}`,
            icon: 'report_problem',
          })
        })
    },

    /**
     * Stop Dreaming
     *
     */
    stopDreaming () {
      this.isWakingUp = true

      const api = axios.create({ baseURL: this.settings.servers[0].base })
      api
        .post('/api/predict', {
          fn_index: 5,
        })
        // @todo catch error
        .then(() => {
          this.isDreaming = false
        })
    },

    /**
     * Starts the next dream
     */
    startNextDream (api, serverId) {
      if (!this.queue.length) return
      
      // Get the next queued item
      const queue = [...this.queue[0]]
      let dream = queue.shift()

      if (!queue.length) {
        this.queue.shift()
      }
    },

    // @todo Add this as a generic prototype
    // @todo Let's revisit how we save after vuex upgrade
    // @todo 🚨 This should be throttled
    autosave () {
      const data = {}
      autosaveFields.forEach(key => {
        data[key] = this[key]
      })
      store.set('txt2Img', data)
    },

    expandImage (ev) {
      this.imageModal = true
      this.imageModalActiveImage = ev
    },
  },
}
</script>

  