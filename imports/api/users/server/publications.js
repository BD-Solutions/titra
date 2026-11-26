import { Match } from 'meteor/check'
import Timecards from '../../timecards/timecards.js'
import Projects from '../../projects/projects.js'
import { Dashboards } from '../../dashboards/dashboards'
import { checkAuthentication, checkAdminAuthentication, canAccessProject } from '../../../utils/server_method_helpers.js'

// only these profile fields of other users may be sent to the client:
// the profile also holds API tokens (APItoken, siwapptoken, zammadtoken)
const safeFields = { 'profile.name': 1, 'profile.avatar': 1, 'profile.avatarColor': 1 }

Meteor.publish('projectUsers', function projectUsers({ projectId }) {
  check(projectId, String)
  checkAuthentication(this)
  let userIds = []
  let handle
  let initializing = true
  let uniqueUsers
  if (projectId === 'all') {
    const projectList = Projects.find(
      { $or: [{ userId: this.userId }, { public: true }, { team: this.userId }] },
      { _id: 1 },
    ).fetch().map((value) => value._id)
    if (Timecards.find({ projectId: { $in: projectList } }).count() <= 0) {
      return this.ready()
    }
    Timecards.find({ projectId: { $in: projectList } }).forEach((timecard) => {
      userIds.push(timecard.userId)
    })
    handle = Timecards.find({ projectId: { $in: projectList } }).observeChanges({
      added: (_id) => {
        if (!initializing) {
          userIds.push(Timecards.findOne(_id).userId)
          uniqueUsers = [...new Set(userIds)]
          this.added('projectUsers', projectId, { users: Meteor.users.find({ _id: { $in: uniqueUsers }, inactive: { $ne: true } }, { fields: safeFields }).fetch() })
        }
      },
      removed: () => {
        if (!initializing) {
          userIds = []
          Timecards.find({ projectId: { $in: projectList } }).forEach((timecard) => {
            userIds.push(timecard.userId)
          })
          this.changed('projectUsers', projectId, { users: Meteor.users.find({ _id: { $in: uniqueUsers }, inactive: { $ne: true } }, { fields: safeFields }).fetch() })
        }
      },
      // don't care about changed
    })
  } else {
    if (!canAccessProject(projectId, this.userId)) {
      return this.ready()
    }
    Timecards.find({ projectId }).forEach((timecard) => {
      userIds.push(timecard.userId)
    })
    handle = Timecards.find({ projectId }).observeChanges({
      added: (_id) => {
        if (!initializing) {
          userIds.push(Timecards.findOne(_id).userId)
          uniqueUsers = [...new Set(userIds)]
          this.added('projectUsers', projectId, { users: Meteor.users.find({ _id: { $in: uniqueUsers }, inactive: { $ne: true } }, { fields: safeFields }).fetch() })
        }
      },
      removed: () => {
        if (!initializing) {
          userIds = []
          Timecards.find({ projectId }).forEach((timecard) => {
            userIds.push(timecard.userId)
          })
          uniqueUsers = [...new Set(userIds)]
          this.changed('projectUsers', projectId, { users: Meteor.users.find({ _id: { $in: uniqueUsers }, inactive: { $ne: true } }, { fields: safeFields }).fetch() })
        }
      },
    })
  }
  uniqueUsers = [...new Set(userIds)]
  initializing = false
  this.added('projectUsers', projectId, { users: Meteor.users.find({ _id: { $in: uniqueUsers }, inactive: { $ne: true } }, { fields: safeFields }).fetch() })
  this.ready()
  this.onStop(() => {
    handle.stop()
  })
})

Meteor.publish('projectTeam', function projectTeam({ userIds }) {
  check(userIds, Array)
  checkAuthentication(this)
  return Meteor.users.find(
    { _id: { $in: userIds }, inactive: { $ne: true } },
    {
      fields: { 'profile.name': 1 },
    },
  )
})

Meteor.publish('dashboardUser', function dashboardUser({ _id }) {
  check(_id, String)
  checkAuthentication(this)
  const dashboard = Dashboards.findOne({ _id })
  return Meteor.users.find({ _id: dashboard.resourceId }, { fields: { 'profile.name': 1 } })
})

Meteor.publish('userRoles', function userRoles() {
  checkAuthentication(this)
  return Meteor.users.find({ _id: this.userId }, { fields: { profile: 1, isAdmin: 1 } })
})

Meteor.publish('adminUserList', function adminUserList({ limit }) {
  checkAdminAuthentication(this)
  check(limit, Match.Maybe(Number))
  const options = {}
  options.fields = {
    profile: 1, emails: 1, isAdmin: 1, createdAt: 1, inactive: 1,
  }
  options.sort = { createdAt: -1 }
  if (limit) {
    options.limit = limit
  }
  return Meteor.users.find({}, options)
})

Meteor.publish('projectResources', function projectResources({ projectId }) {
  check(projectId, Match.OneOf(String, Array))
  checkAuthentication(this)
  let userIds = []
  let handle
  let initializing = true
  let uniqueUsers
  if (projectId.includes('all')) {
    const projectList = Projects.find(
      { $or: [{ userId: this.userId }, { public: true }, { team: this.userId }] },
      { _id: 1 },
    ).fetch().map((value) => value._id)
    if (Timecards.find({ projectId: { $in: projectList } }).count() <= 0) {
      return this.ready()
    }
    Timecards.find({ projectId: { $in: projectList } }).forEach((timecard) => {
      userIds.push(timecard.userId)
    })
    handle = Timecards.find({ projectId: { $in: projectList } }).observeChanges({
      added: (_id) => {
        if (!initializing) {
          const newUserId = Timecards.findOne(_id).userId
          if (!userIds.includes(newUserId)) {
            userIds.push(newUserId)
            const meteorUser = Meteor.users
              .findOne({ _id: newUserId, inactive: { $ne: true } }, { fields: safeFields })?.profile
            if (meteorUser) {
              this.added('projectResources', newUserId, meteorUser)
            }
          }
        }
      },
      removed: () => {
        if (!initializing) {
          userIds = []
          Timecards.find({ projectId: { $in: projectList } }).forEach((timecard) => {
            userIds.push(timecard.userId)
          })
          uniqueUsers = [...new Set(userIds)]
          for (const userId of uniqueUsers) {
            const meteorUser = Meteor.users
              .findOne({ _id: userId, inactive: { $ne: true } }, { fields: safeFields })?.profile
            if (meteorUser) {
              this.changed('projectResources', userId, meteorUser)
            }
          }
        }
      },
      // don't care about changed
    })
  } else {
    const requestedProjects = projectId instanceof Array ? projectId : [projectId]
    const accessibleProjects = Projects.find({
      _id: { $in: requestedProjects },
      $or: [{ userId: this.userId }, { public: true }, { team: this.userId }],
    }, { fields: { _id: 1 } }).fetch().map((value) => value._id)
    const selector = { projectId: { $in: accessibleProjects } }
    Timecards.find(selector).forEach((timecard) => {
      userIds.push(timecard.userId)
    })
    handle = Timecards.find(selector).observeChanges({
      added: (_id) => {
        const newUserId = Timecards.findOne(_id).userId
        if (!userIds.includes(newUserId)) {
          const meteorUser = Meteor.users
            .findOne({ _id: newUserId, inactive: { $ne: true } }, { fields: safeFields })?.profile
          if (meteorUser) {
            userIds.push(newUserId)
            this.added('projectResources', newUserId)
          }
        }
      },
      removed: () => {
        if (!initializing) {
          userIds = []
          Timecards.find(selector).forEach((timecard) => {
            userIds.push(timecard.userId)
          })
          uniqueUsers = [...new Set(userIds)]
          uniqueUsers.forEach((userId) => {
            const meteorUser = Meteor.users
              .findOne({ _id: userId, inactive: { $ne: true } }, { fields: safeFields })?.profile
            if (meteorUser) {
              this.changed('projectResources', userId, meteorUser)
            }
          })
        }
      },
    })
  }
  uniqueUsers = [...new Set(userIds)]
  initializing = false
  for (const userId of uniqueUsers) {
    const meteorUser = Meteor.users
      .findOne({ _id: userId, inactive: { $ne: true } }, { fields: safeFields })?.profile
    if (meteorUser) {
      this.added('projectResources', userId, meteorUser)
    }
  }
  this.ready()
  this.onStop(() => {
    handle.stop()
  })
})
