import { Dashboards } from './dashboards'
import { periodToDates } from '../../utils/periodHelpers.js'
import Projects from '../projects/projects.js'
import { checkAuthentication, canAccessProject } from '../../utils/server_method_helpers.js'
import { getGlobalSetting } from '../../utils/frontend_helpers'

Meteor.methods({
  addDashboard({
    projectId, resourceId, customer, timePeriod,
  }) {
    check(projectId, String)
    check(timePeriod, String)
    check(resourceId, String)
    check(customer, String)
    checkAuthentication(this)
    // a dashboard link is public: it may only expose projects the creator can see
    if (customer !== 'all') {
      const customerProjects = Projects.find({ customer }, { fields: { _id: 1 } }).fetch()
      if (customerProjects.length === 0
        || customerProjects.some((project) => !canAccessProject(project._id, this.userId))) {
        throw new Meteor.Error('notifications.auth_error_method')
      }
    } else if (!canAccessProject(projectId, this.userId)) {
      throw new Meteor.Error('notifications.auth_error_method')
    }
    const { startDate, endDate } = periodToDates(timePeriod)
    const meteorUser = Meteor.users.findOne({ _id: this.userId })
    let timeunit = getGlobalSetting('timeunit')
    let hoursToDays = getGlobalSetting('hoursToDays')
    if (meteorUser.profile.timeunit) {
      timeunit = meteorUser.profile.timeunit
    }
    if (meteorUser.profile.hoursToDays) {
      hoursToDays = meteorUser.profile.hoursToDays
    }
    const _id = Random.id()
    Dashboards.insert({
      _id, projectId, customer, startDate, endDate, resourceId, timeunit, hoursToDays,
    })
    return _id
  },
})
