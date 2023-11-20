import { emConversation, emSilent } from '@/EaseIM/emApis';
import { EMClient } from '@/EaseIM';
const {
  fetchPinConversationFromServer,
  pinConversationItem,
  fetchConversationFromServer,
  removeConversationFromServer,
  sendChannelAck,
} = emConversation();
const {
  getSilentModeForConversationList,
  setSilentModeForConversation,
  clearRemindTypeForConversation,
} = emSilent();
const ConversationStore = {
  state: {
    chattingId: '', //进入聊天页面聊天中的目标聊天用户信息
    pinConversationList: [],
    conversationList: [],
    silentConversationMap: {},
  },
  mutations: {
    SET_CHATING_USERID: (state, conversationId) => {
      state.chattingId = conversationId;
    },
    SET_PIN_CONVERSATION_LIST: (state, pinConversationList) => {
      state.pinConversationList = [...pinConversationList];
    },
    SET_SILENT_CONVERSATION_MAP: (state, payload) => {
      const { type, data } = payload;
      if (type === 'init') {
        state.silentConversationMap = data;
      }
      if (type === 'setSingleSilentMode') {
        const { conversationId, type } = data;
        console.log('>>>>>>免打扰设置type', type);
        if (!state.silentConversationMap[conversationId]) {
          Vue.set(state.silentConversationMap, conversationId, {});
        }
        state.silentConversationMap[conversationId] = { type };
      }
    },
    UPDATE_PIN_CONVERSATION_ITEM: (state, conversationItem) => {
      const { conversationId, isPinned } = conversationItem;
      const pinConversationItemIndex = state.pinConversationList.findIndex(
        (item) => item.conversationId === conversationId
      );
      const unPinConversationItemIndex = state.conversationList.findIndex(
        (item) => item.conversationId === conversationId
      );
      if (isPinned) {
        state.pinConversationList.unshift(conversationItem);
        unPinConversationItemIndex > -1 &&
          state.conversationList.splice(unPinConversationItemIndex, 1);
      } else {
        state.conversationList.unshift(conversationItem);
        pinConversationItemIndex > -1 &&
          state.pinConversationList.splice(pinConversationItemIndex, 1);
      }
    },
    SET_CONVERSATION_LIST: (state, conversationList) => {
      state.conversationList = [...conversationList];
    },
    DELETE_CONVERSATION_ITEM: (state, conversationId) => {
      if (state.pinConversationList.length) {
        state.pinConversationList = state.pinConversationList.filter(
          (item) => item.conversationId !== conversationId
        );
      }
      if (state.conversationList.length) {
        state.conversationList = state.conversationList.filter(
          (item) => item.conversationId !== conversationId
        );
      }
    },
    UPDATE_CONVERSATION_ITEM: (state, payload) => {
      console.log('>>>>更新会话列表');
      const { conversationId, lastMessage } = payload;
      let foundChannel = false;
      state.conversationList.length &&
        state.conversationList.forEach((conversationItem) => {
          if (conversationItem.conversationId === conversationId) {
            //要更新的lastmsg消息来源不为当前id，且不为正在会话中的id则累加未读数。
            if (
              lastMessage.from !== EMClient.user &&
              state.chattingId !== conversationId
            ) {
              conversationItem.unReadCount = conversationItem.unReadCount + 1;
            }
            conversationItem.lastMessage = { ...lastMessage };
            foundChannel = true;
            return;
          }
        });
      if (!foundChannel) {
        console.log('>>>新增会话列表');
        const conversationItem = {
          conversationId,
          conversationType: lastMessage.chatType,
          lastMessage,
          pinnedTime: 0,
          isPinned: false,
          unReadCount: 1,
        };
        console.log('conversationItem', conversationItem);
        state.conversationList.push({
          ...conversationItem,
        });
      }
    },
    clearConversationUnReadNum(state, payload) {
      const { conversationId } = payload;
      state.conversationList.forEach((conversationItem) => {
        if (conversationItem.conversationId === conversationId) {
          conversationItem.unReadCount = 0;
        }
      });
    },
    SET_CONVERSATION_ITEM_READ_SATUS: (state, payload) => {
      const {
        conversationItem: { isPinned, conversationId },
        isRead,
      } = payload;

      const conversationList = isPinned
        ? state.pinConversationList
        : state.conversationList;

      const targetConversationItem = conversationList.find(
        (conversationItem) => conversationItem.conversationId === conversationId
      );

      if (targetConversationItem) {
        if (isRead) {
          targetConversationItem.unReadCount = 0;
        }
        targetConversationItem.isRead = isRead;
      }
    },
  },
  actions: {
    fetchPinConversationList: async ({ commit }) => {
      try {
        const result = await fetchPinConversationFromServer();
        console.log('>>>>>>>置顶会话result', result);
        commit('SET_PIN_CONVERSATION_LIST', result.data.conversations);
      } catch (error) {
        console.log('>>>>>置顶会话列表拉取失败', error);
      }
    },
    fetchConversationList: async ({ commit, dispatch }) => {
      let filteredConversationList = [];
      try {
        const result = await fetchConversationFromServer();
        console.log('>>>>>>>result', result);
        filteredConversationList = result.filter(
          (item) => item.isPinned === false
        );
        commit('SET_CONVERSATION_LIST', [...filteredConversationList]);
        dispatch('fetchSilentConversationList', [...result]);
      } catch (error) {
        console.log('>>>>> 会话列表拉取失败', error);
      }
    },
    //处理会话置顶
    pinConversationItem: async ({ commit }, params) => {
      const { conversationId, conversationType, isPinned } = params;
      try {
        const result = await pinConversationItem({
          conversationId,
          conversationType,
          isPinned,
        });
        commit('UPDATE_PIN_CONVERSATION_ITEM', { ...params });
        console.log('>>>>>>>置顶会话成功', result);
      } catch (error) {
        console.log('>>>>>置顶会话列表拉取失败', error);
      }
    },
    deleteConversation: async ({ commit }, params) => {
      const { conversationId, conversationType } = params;
      try {
        await removeConversationFromServer(conversationId, conversationType);
        commit('DELETE_CONVERSATION_ITEM', conversationId);
      } catch (error) {
        console.log('>>>>会话列表删除失败', error);
      }
    },
    sendConversatonReadedAck: async ({ commit }, params) => {
      const { targetId, chatType } = params;
      sendChannelAck(targetId, chatType);
      commit('clearConversationUnReadNum', { conversationId: targetId });
    },
    //获取会话免打扰状态
    fetchSilentConversationList: async ({ commit }, params) => {
      const conversationList = params;
      const silentConversationListParams = conversationList.map(
        (conversation) => {
          return {
            id: conversation.conversationId,
            type: conversation.conversationType,
          };
        }
      );
      try {
        const { data } = await getSilentModeForConversationList(
          silentConversationListParams
        );
        const silentUserInfo = { ...data?.user, ...data?.group };
        commit('SET_SILENT_CONVERSATION_MAP', {
          type: 'init',
          data: silentUserInfo,
        });
      } catch (error) {
        console.log('>>>>>会话免打扰列表拉取失败', error);
      }
    },
    //设置会话免打扰
    setConversationSilentMode: async ({ commit }, params) => {
      const { conversationId, type } = params;
      try {
        if (params.hasOwnProperty('options')) {
          console.log('>>>>设置会话免打扰');
          await setSilentModeForConversation({ ...params });
          commit('SET_SILENT_CONVERSATION_MAP', {
            type: 'setSingleSilentMode',
            data: {
              conversationId,
              type: 'NONE',
            },
          });
        } else {
          console.log('>>>>>取消会话免打扰');
          await clearRemindTypeForConversation({ ...params });
          commit('SET_SILENT_CONVERSATION_MAP', {
            type: 'setSingleSilentMode',
            data: {
              conversationId,
              type: '',
            },
          });
        }
      } catch (error) {
        console.log('>>>>>>会话设置失败', error);
      }

      // try {
      //   const result = await setSilentModeForConversation({
      //     conversationId,
      //     conversationType,
      //     silentMode,
      //   });
      //   console.log('>>>>>>>设置会话免打扰成功', result);
      // } catch (error) {
      //   console.log('>>>>>设置会话免打扰失败', error);
      // }
    },
    //调整会话已读状态
    setConversationReadStatus: async ({ commit }, params) => {
      const { conversationItem, isRead } = params;
      if (isRead) {
        sendChannelAck(
          conversationItem.conversationId,
          conversationItem.conversationType
        );
        commit('SET_CONVERSATION_ITEM_READ_SATUS', {
          conversationItem,
          isRead: true,
        });
      } else {
        commit('SET_CONVERSATION_ITEM_READ_SATUS', {
          conversationItem,
          isRead: false,
        });
      }
    },
  },
  getters: {
    //排序会话列表
    sortedConversationList(state) {
      return state.conversationList.sort((a, b) => {
        return b.lastMessage.time - a.lastMessage.time;
      });
    },
    //排序指定会话列表
    sortedPinConversationList(state) {
      return state.pinConversationList.sort((a, b) => {
        return b.lastMessage.time - a.lastMessage.time;
      });
    },
    //会话免打扰信息
    silentConversationMap(state) {
      return state.silentConversationMap;
    },
    //会话未读总数
    calcAllUnReadNumFromConversation(state) {
      const pinConversationListUnReadNum = state.pinConversationList.reduce(
        (a, c) => {
          if (
            state.silentConversationMap[c.conversationId] &&
            state.silentConversationMap[c.conversationId]?.type !== 'NONE' &&
            c.unReadCount
          ) {
            return a + c.unReadCount;
          } else {
            return a;
          }
        },
        0
      );
      const conversationListUnReadNum = state.conversationList.reduce(
        (a, c) => {
          if (
            state.silentConversationMap[c.conversationId] &&
            state.silentConversationMap[c.conversationId]?.type !== 'NONE' &&
            c.unReadCount
          ) {
            return a + c.unReadCount;
          } else {
            return a;
          }
        },
        0
      );
      console.log('pinConversationListUnReadNum', pinConversationListUnReadNum);
      return pinConversationListUnReadNum + conversationListUnReadNum;
    },
  },
};
export default ConversationStore;