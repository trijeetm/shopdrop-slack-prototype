import Q from "q";
import Slack from "./slack.js";
import tags from "./tags.js";
import {
  bot_token,
  admin_token,
  bot_port,
  mentor_group_name,
} from "../config";

var api = new Slack(bot_token)

var getId = function(name) {
  return  api.slackApi("groups.list")
  .then(res => {
    var groups = res.groups;
    for (var i = 0; i < groups.length; i++) {
      var group = groups[i];
      if (group.name === name) {
        return group.id;
      }
    }
    throw new Error(`No group with name ${mentor_group_name} found!`);
  });
}

var to = getId(mentor_group_name)
var fro = getId("mentors-r-us");

Q.all([to, fr]).then(function(t, f) {
  return api.slackApi("groups.info", {
    channel: fro
  }).then((info) => {
    var members = info.group.members;
    console.log(info, members);
    members.forEach(function(member) {
      api.slackApi("groups.invite", {
        channel: to
      }).then(function(x) {
        console.log(member, x);
      }).done()
    })
  })
}).done();
