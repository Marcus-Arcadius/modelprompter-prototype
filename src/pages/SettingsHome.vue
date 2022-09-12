<template lang='pug'>
q-page.full-height
  section.content
    h1 Settings

    q-card
      q-card-section
        .text-h6 GPU Servers
      q-card-section
        p
          | Use this to set the Stable Diffusion GPU server with a <code>api/predict</code> API, for example, like <a href="https://github.com/AUTOMATIC1111/stable-diffusion-webui">AUTOMATIC1111/stable-diffusion-webui</a> and <a href="https://github.com/sd-webui/stable-diffusion-webui">sd-webui/stable-diffusion-webui</a>. You can create a fast and free cloud server with Google Colab:
          a(href='https://colab.research.google.com/drive/1Iy-xW9t1-OQWhb0hNxueGij8phCyluOh') https://colab.research.google.com/drive/1Iy-xW9t1-OQWhb0hNxueGij8phCyluOh

      q-card-section
        q-table(title='GPU Server List' :data='settings.servers' :columns='columns' row-key='base')
          //- Add rows
          template(v-slot:top='')
            q-btn(color='secondary' icon='dns' label='Add GPU' @click='addRow')
          //- Rows with inline-edit
          template(v-slot:body='props')
            q-tr(:props='props')
              td(key='base' :props='props')
                | {{props.row.base}}
                q-popup-edit(v-model='props.row.base' auto-save v-slot='scope')
                  q-input(v-model='props.row.base' dense='' autofocus @keyup.enter='scope.set')
              
              q-td(key='actions' :props='props' v-if='settings.servers.length > 1')
                q-btn(color='negative' icon='delete' @click='deleteRow(props)')
</template>

<script>
import {mapState} from 'vuex'
import store from 'store'

export default {
  name: 'SettingsHome',

  computed: {
    ...mapState(['settings'])
  },

  watch: {
    settings: {
      deep: true,
      handler () {
        this.autosave()
      }
    }
  },

  data: () => ({
    columns: [
      { name: 'base', align: 'left', field: 'base', label: 'Base URL' },
      { name: 'actions', align: 'left', label: 'Actions' },
    ],
  }),

  methods: {
    addRow () {
      this.settings.servers.push({ base: '' })
    },

    deleteRow (props) {
      this.settings.servers.splice(props.rowIndex, 1)
    },

    autosave () {
      store.set('settings', this.settings)
    }
  },  
}
</script>