<template lang="pug">
q-layout(view='lHh Lpr lFf')
  //- Header
  q-header.main-header-left-pixel-gap-fix
    q-toolbar
      q-btn(flat dense round icon='fas fa-bars' aria-label='Menu' @click='leftDrawerOpen = !leftDrawerOpen')
      q-toolbar-title(style='flex: 0 0 auto')
        span
          router-link.text-decoration-none.text-white(:to='{name: "txt2Img"}')
            img.gt-sm.q-mr-sm(src='~assets/logo-title.png' height=32 style='vertical-align: middle')
            img.lt-md.q-mr-sm(src='~assets/logo-title-favicon.png' height=32 style='vertical-align: middle')
          a(href='https://github.com/EverestWonder/diffusion-blocks/releases' target='_blank')
            small.gt-xs.q-ml-sm.text-secondary(style='font-size: .65em; display: inline-block; transform: translate(0, -3px)') {{version}}
      q-space

      //- Studio controls
      template(v-if='studio.hasBookmarks && $route.name === "Studio"')
        span.q-mr-sm 📌
        q-btn-group(push dense)
          q-btn(color='tertiary' size='sm' icon='fas fa-caret-square-left' @click='$root.$emit("studio.prevBookmark")')
          q-btn(color='tertiary' size='sm' icon='fas fa-caret-square-right' @click='$root.$emit("studio.nextBookmark")')
      q-space

      //- Handsfree toggle
      q-toggle.no-select(v-if='settings.isFacePointerActive || settings.isFacePointerToggleAlwaysOn' color='negative' dark v-model='settings.isFacePointerActive')
        | Handsfree
        span.gt-sm.q-ml-xs {{settings.isFacePointerActive ? 'enabled' : 'disabled'}}

      //- MIDI toggle
      //- @todo Renable this
      //- q-toggle.no-select(color='negative' dark v-model='isMIDIActive')
      //-   | MIDI
      //-   span.gt-sm.q-ml-xs {{isMIDIActive ? 'enabled' : 'disabled'}}

      //- Notion link
      q-btn.q-ma-xs(type='a' href='https://everestwonder.com/diffusion-blocks' target='_blank')
        q-avatar
          <svg viewBox="0 0 120 126" class="notionLogo" style="width: 18px; height: 18px; display: block; fill: #fff; flex-shrink: 0; backface-visibility: hidden; margin-right: 6px;"><path d="M 20.6927 21.9315C 24.5836 25.0924 26.0432 24.8512 33.3492 24.3638L 102.228 20.2279C 103.689 20.2279 102.474 18.7705 101.987 18.5283L 90.5477 10.2586C 88.3558 8.55699 85.4356 6.60818 79.8387 7.09563L 13.1433 11.9602C 10.711 12.2014 10.2251 13.4175 11.1939 14.3924L 20.6927 21.9315ZM 24.8281 37.9835L 24.8281 110.456C 24.8281 114.351 26.7745 115.808 31.1553 115.567L 106.853 111.187C 111.236 110.946 111.724 108.267 111.724 105.103L 111.724 33.1169C 111.724 29.958 110.509 28.2544 107.826 28.4976L 28.721 33.1169C 25.8018 33.3622 24.8281 34.8225 24.8281 37.9835ZM 99.5567 41.8711C 100.042 44.0622 99.5567 46.2512 97.3618 46.4974L 93.7143 47.2241L 93.7143 100.728C 90.5477 102.43 87.6275 103.403 85.1942 103.403C 81.2983 103.403 80.3226 102.186 77.4044 98.54L 53.5471 61.087L 53.5471 97.3239L 61.0964 99.0275C 61.0964 99.0275 61.0964 103.403 55.0057 103.403L 38.2148 104.377C 37.727 103.403 38.2148 100.973 39.9179 100.486L 44.2996 99.2717L 44.2996 51.36L 38.2158 50.8725C 37.728 48.6815 38.9431 45.5225 42.3532 45.2773L 60.3661 44.0631L 85.1942 82.0036L 85.1942 48.4402L 78.864 47.7136C 78.3781 45.0351 80.3226 43.0902 82.7569 42.849L 99.5567 41.8711ZM 7.5434 5.39404L 76.9175 0.285276C 85.4366 -0.445402 87.6285 0.0440428 92.983 3.93368L 115.128 19.4982C 118.782 22.1747 120 22.9034 120 25.8211L 120 111.187C 120 116.537 118.051 119.701 111.237 120.185L 30.6734 125.05C 25.5584 125.294 23.124 124.565 20.4453 121.158L 4.13735 99.9994C 1.21516 96.1048 0 93.191 0 89.7819L 0 13.903C 0 9.5279 1.94945 5.8785 7.5434 5.39404Z"></path></svg>
        span.gt-sm Roadmap

  //- Sidebar
  q-drawer.main-sidebar.flex-drawer(v-model='leftDrawerOpen' show-if-above bordered :breakpoint='1400')
    q-toolbar.bg-primary.text-white
    q-list.q-pa-sm
      template(v-if='mainNavPanel')
        MainNavLink(v-for='link in mainNavPanel.links' :key='link.title' v-bind='link')
    q-space
    q-list.q-pb-sm(dense)
      q-item
        ImporterExporter

  //- Page
  q-page-container
    router-view

  //- Status bar
  q-footer
    q-bar.bg-inactive
      div
        q-badge.q-mr-sm.cursor-pointer(v-if='eventLogs.error.length' color='negative' @click='dialog.error = true') {{eventLogs.error.length}}
        q-badge.q-mr-sm.cursor-pointer(v-if='eventLogs.warn.length' color='block-orange' @click='dialog.warning = true') {{eventLogs.warn.length}}
        span.text-info Last event:
        span.text-white.q-ml-sm {{lastEvent.log}}

  //- Dialogs
  DialogConfirm(v-model='dialog.error'
    @accept='clearErrorLogs'
    cancel-label='Close'
    accept-label='Clear errors'
    bg='negative'
    icon='fas fa-bug'
    title='Error Logs')
    q-table(:data='eventLogs.error' :columns='columns.error')
      template(v-slot:body-cell-log='props')
        q-td.white-space-normal(:props='props') {{props.row.log}}

  DialogConfirm(v-model='dialog.warning'
    @accept='clearWarningLogs'
    cancel-label='Close'
    accept-label='Clear warnings'
    bg='block-orange'
    icon='fas fa-bug'
    title='Warning Logs')
    q-table(:data='eventLogs.warn' :columns='columns.error')
      template(v-slot:body-cell-log='props')
        q-td.white-space-normal(:props='props') {{props.row.log}}
</template>

<script>
import {get, set} from 'lodash'
import pkg from '../../package.json'
import MainNavLink from 'components/mainNavPanel/Link'
import ImporterExporter from 'components/ImporterExporter'
import DialogConfirm from 'components/dialog/Confirm'
import {mapState} from 'vuex'

export default {
  name: 'MainLayout',

  components: {ImporterExporter, MainNavLink, DialogConfirm},

  computed: {
    ...mapState(['user', 'lastEvent', 'eventLogs', 'studio', 'settings'])
  },

  watch: {
    leftDrawerOpen () {
      Array.from(Array(20).keys()).forEach(interval => {
        setTimeout(() => {
          window.dispatchEvent(new Event('resize'))
        }, interval * 25)
      })
    }
  },
  
  data () {
    return {
      mainNavPanel: {
        links: [
          {
            title: 'Home',
            description: 'Get an overview of what Diffusion Blocks is about',
            link: '/',
            icon: 'fas fa-home'
          },
          // {
          //   title: 'Studio',
          //   description: 'Visually map and program your MIDI devices',
          //   link: '/studio',
          //   icon: 'fas fa-puzzle-piece fa-flip-both'
          // },
          // {
          //   title: 'Factory',
          //   description: 'Create custom blocks with JavaScript',
          //   link: '/factory',
          //   icon: 'fas fa-laptop-code'
          // },
          // {
          //   title: 'Library',
          //   description: 'Browse our library of user created Diffusion Blocks and learn how to use them',
          //   link: '/library',
          //   icon: 'fas fa-cubes'
          // },
          {
            title: 'Settings',
            description: 'Setup GPU servers and other settings',
            link: '/settings',
            icon: 'fas fa-cogs'
          }
        ]
      },

      columns: {
        error: [
          {
            label: 'Log',
            field: 'log',
            name: 'log',
            sortable: true,
            align: 'left'
          }
        ]
      },

      // Dialog models
      dialog: {
        error: false,
        warning: false
      },

      isMIDIActive: false,
      
      version: pkg.version,
      leftDrawerOpen: false,
      links: []
    }
  },

  /**
   * Load and setup payload
   * - Binds global navigation shortcuts
   */
  mounted () {
    this.$mousetrap.bind('s', ev => {
      ev.preventDefault()
      this.$router.push({name: 'Studio'})
    })

    this.$mousetrap.bind('f', ev => {
      ev.preventDefault()
      this.$router.push({name: 'Factory'})
    })
  },

  destroyed () {
    this.$mousetrap.unbind('s')
    this.$mousetrap.unbind('f')
  },

  methods: {
    /**
     * Clear logs
     */
    clearErrorLogs () {
      this.$store.commit('set', ['eventLogs.error', []])
    },
    clearWarningLogs () {
      this.$store.commit('set', ['eventLogs.error', []])
      this.$store.commit('set', ['eventLogs.warn', []])
    },
    clearAllLogs () {
      this.$store.commit('set', ['eventLogs.error', []])
      this.$store.commit('set', ['eventLogs.warn', []])
    }
  }
}
</script>
