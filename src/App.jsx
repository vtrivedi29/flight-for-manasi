import { useState, useEffect, useRef } from "react";
import "./index.css";
import { supabase } from "./supabaseClient";

const ACTIVITIES = [
  "Coffee",
  "Movie",
  "Board games",
  "Nature walk",
  "Study",
  "Do nothing together",
  "Play a sport",
  "Stay in 😈"
];

const VIBES = [
  "Cozy",
  "Adventurous",
  "Lazy",
  "Romantic",
  "Chaotic and Energetic",
  "😈"
];

const FOODS = [
  "Pizza",
  "Thai",
  "Chicken Sandwich",
  "Wings",
  "Bagels",
  "Sushi",
  "Snacks",
  "Pasta",
  "Indian",
  "Chinese",
  "Healthy",
  "You 😈",
];

const DIRECTION_LABELS = {
  nyuToIu: "NYU → IU",
  iuToNyu: "IU → NYU",
};

const PROFILE_KEY = "veyd-and-manasi";

const USERS = {
  veyd: { id: "veyd", displayName: "Veyd" },
  manasi: { id: "manasi", displayName: "Manasi" },
};

const getEmptyPlans = () => ({
  nyuToIu: { activity: [], vibe: "", food: [], locked: false },
  iuToNyu: { activity: [], vibe: "", food: [], locked: false },
});

function OptionGroup({
  title,
  subtitle,
  options,
  selected,
  onSelect,
  placeholder,
  multi = false,
}) {
  const [otherInput, setOtherInput] = useState("");

  const selectedArray = multi
    ? Array.isArray(selected)
      ? selected
      : selected
      ? [selected]
      : []
    : [];

  const customValues = multi
    ? selectedArray.filter((val) => !options.includes(val))
    : [];

  const allOptions = multi ? [...options, ...customValues] : options;

  const isCustom = multi
    ? customValues.length > 0
    : selected && !options.includes(selected);

  const isPillSelected = (opt) => {
    if (multi) {
      return selectedArray.includes(opt);
    }
    return selected === opt;
  };

  const handlePillClick = (opt) => {
    if (multi) {
      if (selectedArray.includes(opt)) {
        onSelect(selectedArray.filter((val) => val !== opt));
      } else {
        onSelect([...selectedArray, opt]);
      }
    } else {
      onSelect(opt);
    }
  };

  const handleOtherClick = () => {
    if (!multi) {
      if (!isCustom) {
        onSelect("");
      }
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    if (multi) {
      setOtherInput(val);
    } else {
      onSelect(val);
    }
  };

  const handleInputKeyDown = (e) => {
    if (!multi) return;
    if (e.key === "Enter") {
      e.preventDefault();
      const trimmed = otherInput.trim();
      if (!trimmed) return;
      if (!selectedArray.includes(trimmed)) {
        onSelect([...selectedArray, trimmed]);
      }
      setOtherInput("");
    }
  };

  const inputValue = multi ? otherInput : isCustom ? selected : "";

  return (
    <div className="option-group">
      <div className="option-group-header">
        <h3 className="option-group-title">{title}</h3>
        {subtitle && <p className="option-group-subtitle">{subtitle}</p>}
      </div>
      <div className="options-grid">
        {allOptions.map((opt) => (
          <button
            key={opt}
            type="button"
            className={
              "pill-option" + (isPillSelected(opt) ? " pill-option--selected" : "")
            }
            onClick={() => handlePillClick(opt)}
          >
            {opt}
          </button>
        ))}
        <button
          type="button"
          className={
            "pill-option" +
            (isCustom || (multi && customValues.length > 0)
              ? " pill-option--selected"
              : "")
          }
          onClick={handleOtherClick}
        >
          Other
        </button>
      </div>

      <div className="option-other">
        <span className="option-other-label">Or type your own:</span>
        <input
          type="text"
          className="option-other-input"
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
        />
      </div>
    </div>
  );
}

function ScheduleView({
  direction,
  plan,
  onBack,
  onOpenSchedules,
  existingScheduleId = null,
  readOnly = false,
  existingPostId = null,
  currentUser = null,
}) {
  const [scheduleId, setScheduleId] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [doDuration, setDoDuration] = useState(60);
  const columnRef = useRef(null);
  const [dragState, setDragState] = useState(null);
  const [savingPost, setSavingPost] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [previewLiked, setPreviewLiked] = useState(false);
  const [previewComments, setPreviewComments] = useState([]);
  const [previewCommentText, setPreviewCommentText] = useState("");
  const [previewMetaLoading, setPreviewMetaLoading] = useState(false);
  useEffect(() => {
    if (!readOnly || !existingPostId) return;

    async function loadPreviewMeta() {
      setPreviewMetaLoading(true);
      try {
        // Load comments for this post
        const { data: commentsData, error: commentsError } = await supabase
          .from("schedule_comments")
          .select("id, post_id, author_name, content, created_at")
          .eq("post_id", existingPostId)
          .order("created_at", { ascending: true });

        if (!commentsError && commentsData) {
          setPreviewComments(commentsData);
        } else if (commentsError) {
          console.error("Error loading preview comments", commentsError);
        }

        // Load like for this profile/post
        const { data: likesData, error: likesError } = await supabase
          .from("schedule_likes")
          .select("id")
          .eq("post_id", existingPostId)
          .eq("profile_key", PROFILE_KEY)
          .maybeSingle();

        if (likesError && likesError.code !== "PGRST116") {
          // PGRST116 is no rows found for maybeSingle
          console.error("Error loading preview like", likesError);
        }

        setPreviewLiked(!!likesData);
      } catch (e) {
        console.error("Unexpected error loading preview meta", e);
      } finally {
        setPreviewMetaLoading(false);
      }
    }

    loadPreviewMeta();
  }, [readOnly, existingPostId]);
  const togglePreviewLike = async () => {
    if (!existingPostId) return;
    const nextLiked = !previewLiked;
    setPreviewLiked(nextLiked);

    try {
      if (!nextLiked) {
        await supabase
          .from("schedule_likes")
          .delete()
          .eq("post_id", existingPostId)
          .eq("profile_key", PROFILE_KEY);
      } else {
        await supabase.from("schedule_likes").insert({
          post_id: existingPostId,
          profile_key: PROFILE_KEY,
        });
      }
    } catch (e) {
      console.error("Error toggling preview like", e);
    }
  };

  const submitPreviewComment = async () => {
    if (!existingPostId) return;
    const text = previewCommentText.trim();
    if (!text) return;

    try {
      const { data, error } = await supabase
        .from("schedule_comments")
        .insert({
          post_id: existingPostId,
          profile_key: PROFILE_KEY,
          author_name: currentUser?.displayName || "Us",
          content: text,
        })
        .select()
        .single();

      if (error) {
        console.error("Error adding preview comment", error);
        return;
      }

      setPreviewComments((prev) => [...prev, data]);
      setPreviewCommentText("");
    } catch (e) {
      console.error("Unexpected error adding preview comment", e);
    }
  };

  useEffect(() => {
    if (!dragState || readOnly) return;

    const moveHandler = (e) => {
      handleMouseMove(e);
    };

    const upHandler = () => {
      handleMouseUp();
    };

    window.addEventListener("mousemove", moveHandler);
    window.addEventListener("mouseup", upHandler);

    return () => {
      window.removeEventListener("mousemove", moveHandler);
      window.removeEventListener("mouseup", upHandler);
    };
  }, [dragState, readOnly]);

  const DAY_START = 8 * 60; // 8:00 AM
  const DAY_END = 24 * 60; // midnight
  const DAY_MINUTES = DAY_END - DAY_START;
  const TRASH_HEIGHT = 40; // bottom zone (in px) that acts as a delete area
  const COLUMN_HEIGHT = DAY_MINUTES + TRASH_HEIGHT; // schedule + trash area
  
  useEffect(() => {
    async function ensureSchedule() {
      setLoading(true);
      try {
        if (existingScheduleId) {
          // Open an existing schedule (from the board)
          setScheduleId(existingScheduleId);
          setLoading(false);
          return;
        }

        // Otherwise create a brand-new empty schedule
        const { data: inserted, error: insertError } = await supabase
          .from("trip_schedules")
          .insert({
            profile_key: PROFILE_KEY,
            direction,
            day_label: "Day 1",
          })
          .select()
          .single();

        if (insertError) {
          console.error("Error creating schedule", insertError);
          setLoading(false);
          return;
        }

        setScheduleId(inserted.id);
      } catch (e) {
        console.error("Unexpected error creating schedule", e);
      } finally {
        setLoading(false);
      }
    }

    ensureSchedule();
  }, [direction, existingScheduleId]);

  useEffect(() => {
    if (!scheduleId) return;

    async function fetchBlocks() {
      try {
        const { data, error } = await supabase
          .from("trip_schedule_blocks")
          .select("*")
          .eq("schedule_id", scheduleId)
          .order("start_minutes", { ascending: true });

        if (error) {
          console.error("Error loading schedule blocks", error);
          return;
        }

        setBlocks(data || []);
      } catch (e) {
        console.error("Unexpected error loading schedule blocks", e);
      }
    }

    fetchBlocks();
  }, [scheduleId]);

  const minutesToTop = (minutes) => {
    return minutes - DAY_START;
  };

  const durationToHeight = (start, end) => {
    return end - start;
  };

  const formatHourLabel = (hour) => {
    const suffix = hour >= 12 ? "PM" : "AM";
    const displayHour = ((hour + 11) % 12) + 1;
    return `${displayHour} ${suffix}`;
  };

  const formatTimeLabel = (minutes) => {
    const total = Math.round(minutes);
    const hour = Math.floor(total / 60);
    const mins = total % 60;
    const suffix = hour >= 12 ? "PM" : "AM";
    const displayHour = ((hour + 11) % 12) + 1;
    const paddedMins = mins.toString().padStart(2, "0");
    return `${displayHour}:${paddedMins} ${suffix}`;
  };

  const getBlockGradient = (startMinutes) => {
    // Use same bounds as DAY_START/DAY_END (8:00 → 24:00)
    const minM = DAY_START;
    const maxM = DAY_END;
    const clamped = Math.min(Math.max(startMinutes, minM), maxM);
    const t = (clamped - minM) / (maxM - minM); // 0 → 1 through the day

    // Interpolate from light blue to deep blue
    // Light:  #93c5fd (147,197,253)
    // Dark:   #1e3a8a (30,58,138)
    const lerp = (a, b) => Math.round(a + (b - a) * t);

    const r1 = lerp(147, 30);
    const g1 = lerp(197, 58);
    const b1 = lerp(253, 138);

    // Slightly darker second stop to keep the gradient interesting
    const r2 = lerp(125, 16);
    const g2 = lerp(180, 41);
    const b2 = lerp(252, 121);

    return `linear-gradient(135deg, rgb(${r1}, ${g1}, ${b1}), rgb(${r2}, ${g2}, ${b2}))`;
  };

  const handleSaveScheduleToBoard = async () => {
    if (!scheduleId) return;
    setSavingPost(true);
    setSaveError(null);

    try {
      const vibeLabel = plan?.vibe || "Surprise";
      const place = direction === "nyuToIu" ? "IU" : "NYU";
      const title = `${currentUser?.displayName || "Us"}'s ${vibeLabel} Day in ${place}`;

      const { error } = await supabase.from("schedule_posts").upsert(
        {
          profile_key: PROFILE_KEY,
          schedule_id: scheduleId,
          direction,
          day_label: "Day 1",
          title,
          author_name: currentUser?.displayName || null,
        },
        { onConflict: "schedule_id" }
      );

      if (error) {
        console.error("Error saving schedule post", error);
        setSaveError("Could not save right now. Try again in a bit?");
        return;
      }

      if (onOpenSchedules) {
        onOpenSchedules();
      }
    } catch (e) {
      console.error("Unexpected error saving schedule post", e);
      setSaveError("Something went wrong while saving.");
    } finally {
      setSavingPost(false);
    }
  };

  const computeDefaultStart = (durationMinutes) => {
    const base = 9 * 60; // 9:00 AM
    if (!blocks || blocks.length === 0) {
      return Math.min(Math.max(base, DAY_START), DAY_END - durationMinutes);
    }
    const last = blocks[blocks.length - 1];
    const next = Math.max(base, last.end_minutes + 15);
    return Math.min(Math.max(next, DAY_START), DAY_END - durationMinutes);
  };

  const addBlock = async (kind, label, durationMinutes) => {
    if (!scheduleId) return;
    const start = computeDefaultStart(durationMinutes);
    const end = start + durationMinutes;

    try {
      const { data, error } = await supabase
        .from("trip_schedule_blocks")
        .insert({
          schedule_id: scheduleId,
          label,
          kind,
          day_index: 0,
          start_minutes: start,
          end_minutes: end,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating schedule block", error);
        return;
      }

      setBlocks((prev) =>
        [...prev, data].sort((a, b) => a.start_minutes - b.start_minutes)
      );
    } catch (e) {
      console.error("Unexpected error creating schedule block", e);
    }
  };

  const handleBlockMouseDown = (e, block) => {
    if (readOnly) return;
    if (!columnRef.current) return;
    e.preventDefault();
    const rect = columnRef.current.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const startPx = minutesToTop(block.start_minutes);
    const offsetY = clickY - startPx;
    const duration = block.end_minutes - block.start_minutes;

    setDragState({
      id: block.id,
      offsetY,
      duration,
      latestTop: startPx,
    });
  };

  const handleMouseMove = (e) => {
    if (readOnly) return;
    if (!dragState || !columnRef.current) return;
    const rect = columnRef.current.getBoundingClientRect();
    let newTop = e.clientY - rect.top - dragState.offsetY;

    if (newTop < 0) newTop = 0;
    if (newTop > COLUMN_HEIGHT - dragState.duration) {
      newTop = COLUMN_HEIGHT - dragState.duration;
    }

    // For the actual time, clamp to the schedule region only (exclude trash)
    const clampedForTime = Math.min(newTop, DAY_MINUTES - dragState.duration);
    const newStart = DAY_START + Math.round(clampedForTime);
    const newEnd = newStart + dragState.duration;

    setBlocks((prev) =>
      prev.map((b) =>
        b.id === dragState.id
          ? { ...b, start_minutes: newStart, end_minutes: newEnd }
          : b
      )
    );

    setDragState((prev) =>
      prev && prev.id === dragState.id ? { ...prev, latestTop: newTop } : prev
    );
  };

  const handleMouseUp = async () => {
    if (readOnly) {
      setDragState(null);
      return;
    }
    if (!dragState) return;
    const block = blocks.find((b) => b.id === dragState.id);
    if (!block) {
      setDragState(null);
      return;
    }

    const top =
      dragState.latestTop != null
        ? dragState.latestTop
        : block.start_minutes - DAY_START;
    const bottom = top + dragState.duration;
    // Trash zone lives below the schedule region (after DAY_MINUTES)
    const inTrash = bottom >= DAY_MINUTES;

    setDragState(null);

    if (inTrash) {
      try {
        const { error } = await supabase
          .from("trip_schedule_blocks")
          .delete()
          .eq("id", block.id);

        if (error) {
          console.error("Error deleting block", error);
        } else {
          setBlocks((prev) => prev.filter((b) => b.id !== block.id));
        }
      } catch (e) {
        console.error("Unexpected error deleting schedule block", e);
      }
      return;
    }

    try {
      const { error } = await supabase
        .from("trip_schedule_blocks")
        .update({
          start_minutes: block.start_minutes,
          end_minutes: block.end_minutes,
        })
        .eq("id", block.id);

      if (error) {
        console.error("Error updating block time", error);
      }
    } catch (e) {
      console.error("Unexpected error updating block time", e);
    }
  };

  const handleMouseLeave = () => {
    if (readOnly) return;
    if (dragState) {
      handleMouseUp();
    }
  };

  const activities = Array.isArray(plan.activity) ? plan.activity : [];
  const foods = Array.isArray(plan.food) ? plan.food : [];

  const handleAddBasicItem = (kind) => {
    if (kind === "shower") {
      addBlock("shower", "Shower", 30);
    } else if (kind === "goodmorning") {
      addBlock("goodmorning", "Say goodmorning", 15);
    } else if (kind === "goodnight") {
      addBlock("goodnight", "Say goodnight", 15);
    } else if (kind === "getready") {
      addBlock("getready", "Get ready", 30);
    }
  };

  return (
    <div className="schedule-view">
      <div className="schedule-header">
        <button
          type="button"
          className="schedule-back-button"
          onClick={onBack}
        >
          ← Back to schedules
        </button>
        <div>
          <h2 className="schedule-title">
            {DIRECTION_LABELS[direction]} — Day 1 schedule
          </h2>
          <p className="schedule-subtitle">
            Drag blocks up and down to adjust times. Add items from our picks or
            the basics.
          </p>
        </div>
        {!readOnly && (
          <button
            type="button"
            className="schedule-save-button"
            onClick={handleSaveScheduleToBoard}
            disabled={!scheduleId || savingPost}
          >
            {savingPost ? "Saving…" : "Save this day to Schedules"}
          </button>
        )}
      </div>

      {saveError && (
        <p className="schedule-error-text">{saveError}</p>
      )}

      {loading && <p className="schedule-loading-text">Loading schedule…</p>}

      {!loading && (
        <>
          <div className="schedule-layout">
            {!readOnly && (
              <div className="schedule-palette">
                <div className="schedule-palette-section">
                  <h3 className="schedule-palette-title">From what we do</h3>
                  <div className="schedule-palette-row">
                    <label className="schedule-palette-label">
                      Duration for activities:
                      <select
                        className="schedule-duration-select"
                        value={doDuration}
                        onChange={(e) =>
                          setDoDuration(parseInt(e.target.value, 10))
                        }
                      >
                        <option value={30}>30 min</option>
                        <option value={60}>1 hour</option>
                        <option value={90}>1.5 hours</option>
                        <option value={120}>2 hours</option>
                        <option value={150}>2.5 hours</option>
                      </select>
                    </label>
                  </div>
                  <div className="schedule-palette-items">
                    {activities.length === 0 && (
                      <p className="schedule-empty">
                        No activities selected yet in the planner.
                      </p>
                    )}
                    {activities.map((act) => (
                      <div key={act} className="schedule-palette-item">
                        <span>{act}</span>
                        <button
                          type="button"
                          className="schedule-palette-add"
                          onClick={() => addBlock("do", act, doDuration)}
                        >
                          Add
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="schedule-palette-section">
                  <h3 className="schedule-palette-title">From what we eat</h3>
                  <p className="schedule-palette-hint">
                    Meals are set to 1.5 hours.
                  </p>
                  <div className="schedule-palette-items">
                    {foods.length === 0 && (
                      <p className="schedule-empty">
                        No food picks yet in the planner.
                      </p>
                    )}
                    {foods.map((food) => (
                      <div key={food} className="schedule-palette-item">
                        <span>{food}</span>
                        <button
                          type="button"
                          className="schedule-palette-add"
                          onClick={() => addBlock("eat", food, 90)}
                        >
                          Add
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="schedule-palette-section">
                  <h3 className="schedule-palette-title">Basics</h3>
                  <div className="schedule-palette-items">
                    <div className="schedule-palette-item">
                      <span>Shower (30 min)</span>
                      <button
                        type="button"
                        className="schedule-palette-add"
                        onClick={() => handleAddBasicItem("shower")}
                      >
                        Add
                      </button>
                    </div>
                    <div className="schedule-palette-item">
                      <span>Say goodmorning (15 min)</span>
                      <button
                        type="button"
                        className="schedule-palette-add"
                        onClick={() => handleAddBasicItem("goodmorning")}
                      >
                        Add
                      </button>
                    </div>
                    <div className="schedule-palette-item">
                      <span>Say goodnight (15 min)</span>
                      <button
                        type="button"
                        className="schedule-palette-add"
                        onClick={() => handleAddBasicItem("goodnight")}
                      >
                        Add
                      </button>
                    </div>
                    <div className="schedule-palette-item">
                      <span>Get ready (30 min)</span>
                      <button
                        type="button"
                        className="schedule-palette-add"
                        onClick={() => handleAddBasicItem("getready")}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="schedule-column-wrapper">
              <div
                className="schedule-column"
                ref={columnRef}
                style={{ height: COLUMN_HEIGHT }}
              >
                {Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }).map(
                  (_, idx) => {
                    const hour = DAY_START / 60 + idx;
                    const top = hour * 60 - DAY_START;
                    return (
                      <div
                        key={hour}
                        className="schedule-hour-line"
                        style={{ top }}
                      >
                        <span className="schedule-hour-label">
                          {formatHourLabel(hour)}
                        </span>
                      </div>
                    );
                  }
                )}

                {blocks.map((block) => (
                  <div
                    key={block.id}
                    className="schedule-block"
                    style={{
                      top: minutesToTop(block.start_minutes),
                      height: durationToHeight(
                        block.start_minutes,
                        block.end_minutes
                      ),
                      background: getBlockGradient(block.start_minutes),
                    }}
                    onMouseDown={(e) => handleBlockMouseDown(e, block)}
                  >
                    <div className="schedule-block-inner">
                      <span className="schedule-block-label">{block.label}</span>
                      {dragState && dragState.id === block.id && (
                        <span className="schedule-block-time-inline">
                          {formatTimeLabel(block.start_minutes)} –{" "}
                          {formatTimeLabel(block.end_minutes)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {!readOnly && (
                  <div className="schedule-trash-zone">
                    🗑 Drag here to delete
                  </div>
                )}
              </div>
            </div>
          </div>

          {readOnly && existingPostId && (
            <div className="schedule-preview-meta">
              {previewMetaLoading && (
                <p className="schedule-loading-text">Loading reactions…</p>
              )}

              <div className="schedule-card-actions schedule-preview-actions">
                <button
                  type="button"
                  className={
                    "schedule-like-button" +
                    (previewLiked ? " schedule-like-button--active" : "")
                  }
                  onClick={togglePreviewLike}
                >
                  {previewLiked ? "♥ Liked" : "♡ Like"}
                </button>
              </div>

              <div className="schedule-comments">
                {previewComments.length > 0 && (
                  <ul className="schedule-comments-list">
                    {previewComments.map((c) => (
                      <li key={c.id} className="schedule-comment">
                        <span className="schedule-comment-author">
                          {c.author_name || "Us"}
                        </span>
                        <span className="schedule-comment-text">
                          {c.content}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="schedule-comment-form">
                  <input
                    type="text"
                    placeholder="Add a little note…"
                    value={previewCommentText}
                    onChange={(e) => setPreviewCommentText(e.target.value)}
                  />
                  <button type="button" onClick={submitPreviewComment}>
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SchedulesPage({ onCreateNew, onOpenSchedule, currentUser }) {  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [likes, setLikes] = useState({});
  const [commentText, setCommentText] = useState({});

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { data: postsData, error: postsError } = await supabase
          .from("schedule_posts")
          .select(
            "id, schedule_id, direction, day_label, title, note, author_name, created_at"
          )
          .eq("profile_key", PROFILE_KEY)
          .order("created_at", { ascending: false });

        if (postsError) {
          console.error("Error loading schedule posts", postsError);
          setLoading(false);
          return;
        }

        const postIds = postsData.map((p) => p.id);
        let commentsByPost = {};
        let likesMap = {};

        if (postIds.length > 0) {
          const { data: commentsData, error: commentsError } = await supabase
            .from("schedule_comments")
            .select("id, post_id, author_name, content, created_at")
            .in("post_id", postIds)
            .order("created_at", { ascending: true });

          if (commentsError) {
            console.error("Error loading comments", commentsError);
          } else {
            commentsByPost = commentsData.reduce((acc, c) => {
              acc[c.post_id] = acc[c.post_id] || [];
              acc[c.post_id].push(c);
              return acc;
            }, {});
          }

          const { data: likesData, error: likesError } = await supabase
            .from("schedule_likes")
            .select("post_id")
            .in("post_id", postIds)
            .eq("profile_key", PROFILE_KEY);

          if (likesError) {
            console.error("Error loading likes", likesError);
          } else {
            likesData.forEach((row) => {
              likesMap[row.post_id] = true;
            });
          }
        }

        const merged = postsData.map((p) => ({
          ...p,
          comments: commentsByPost[p.id] || [],
        }));

        setPosts(merged);
        setLikes(likesMap);
      } catch (e) {
        console.error("Unexpected error loading schedule posts", e);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const toggleLike = async (postId) => {
    const currentlyLiked = !!likes[postId];
    setLikes((prev) => ({ ...prev, [postId]: !currentlyLiked }));

    try {
      if (currentlyLiked) {
        await supabase
          .from("schedule_likes")
          .delete()
          .eq("post_id", postId)
          .eq("profile_key", PROFILE_KEY);
      } else {
        await supabase.from("schedule_likes").insert({
          post_id: postId,
          profile_key: PROFILE_KEY,
        });
      }
    } catch (e) {
      console.error("Error toggling like", e);
    }
  };

  const handleCommentChange = (postId, value) => {
    setCommentText((prev) => ({ ...prev, [postId]: value }));
  };

  const submitComment = async (postId) => {
    const text = (commentText[postId] || "").trim();
    if (!text) return;

    try {
      const { data, error } = await supabase
        .from("schedule_comments")
        .insert({
          post_id: postId,
          profile_key: PROFILE_KEY,
          author_name: currentUser?.displayName || "Us", // you can change this later / make dynamic
          content: text,
        })
        .select()
        .single();

      if (error) {
        console.error("Error adding comment", error);
        return;
      }

      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, comments: [...p.comments, data] } : p
        )
      );
      setCommentText((prev) => ({ ...prev, [postId]: "" }));
    } catch (e) {
      console.error("Unexpected error adding comment", e);
    }
  };

    const deleteSchedule = async (post) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this schedule? This will remove its likes, comments, and day blocks."
    );
    if (!confirmDelete) return;

    // Optimistic UI: remove it locally right away
    setPosts((prev) => prev.filter((p) => p.id !== post.id));

    try {
      // Remove likes and comments for this post
      await supabase
        .from("schedule_likes")
        .delete()
        .eq("post_id", post.id);

      await supabase
        .from("schedule_comments")
        .delete()
        .eq("post_id", post.id);

      // Remove blocks and the underlying schedule row
      await supabase
        .from("trip_schedule_blocks")
        .delete()
        .eq("schedule_id", post.schedule_id);

      await supabase
        .from("trip_schedules")
        .delete()
        .eq("id", post.schedule_id);

      // Finally remove the schedule post itself
      await supabase
        .from("schedule_posts")
        .delete()
        .eq("id", post.id);
    } catch (e) {
      console.error("Unexpected error deleting schedule", e);
      // If you want, you could re-add the post to state on error
    }
  };

  return (
    <div className="schedules-page">
      <div className="schedule-header">
        <div>
          <h2 className="schedule-title">Our saved schedules</h2>
          <p className="schedule-subtitle">
            This is where we can react and leave notes for each other.
          </p>
        </div>
      </div>

      {loading && <p className="schedule-loading-text">Loading schedules…</p>}

      <section className="card summary-card summary-card--visible schedules-love-card">
        <p className="summary-text">
          I know I couldn't make it this weekend, but why would that stop us from looking forward?
          We have so many exciting things to plan and I can't wait for the next time I see you! This 
          app serves not only as a cute little thing I made to say sorry, but something we can actually 
          make use out of in planning our visits with each other. I hope you enjoy it.
        </p>
        <p className="summary-text">
          I know I didn't show up today, I will do better: starting with the first plans we make. I love you Manasi ❤️"
        </p>
        <p className="closing">
          Love,
          <br />
          Veyd
        </p>
      </section>

      {!loading && posts.length === 0 && (
        <p className="schedule-loading-text">
          No saved schedules yet. Save one from the day view and it’ll show up
          here.
        </p>
      )}

      {!loading && posts.length > 0 && (
        <div className="schedules-list">
          {posts.map((post) => (
            <article key={post.id} className="schedule-card">
              <header className="schedule-card-header">
                <h3 className="schedule-card-title">
                  {post.title || `Day 1 • ${DIRECTION_LABELS[post.direction]}`}
                </h3>
                <span className="schedule-card-meta">
                  {post.day_label} · {DIRECTION_LABELS[post.direction]}
                  {post.author_name && (
                    <>
                      {" "}
                      · Made by {post.author_name}
                    </>
                  )}
                </span>
              </header>

              {post.note && (
                <p className="schedule-card-note">{post.note}</p>
              )}

              <div className="schedule-card-actions">
                <button
                  type="button"
                  className={
                    "schedule-like-button" +
                    (likes[post.id] ? " schedule-like-button--active" : "")
                  }
                  onClick={() => toggleLike(post.id)}
                >
                  {likes[post.id] ? "♥ Liked" : "♡ Like"}
                </button>

                <button
                  type="button"
                  className="schedule-open-button"
                  onClick={() =>
                    onOpenSchedule &&
                    onOpenSchedule(post.schedule_id, post.direction, post.id)
                  }
                >
                  Open this day
                </button>
                
                <button
                  type="button"
                  className="schedule-delete-button"
                  onClick={() => deleteSchedule(post)}
                >
                  Delete
                </button>
              </div>

              <div className="schedule-comments">
                {post.comments.length > 0 && (
                  <ul className="schedule-comments-list">
                    {post.comments.map((c) => (
                      <li key={c.id} className="schedule-comment">
                        <span className="schedule-comment-author">
                          {c.author_name || "Us"}
                        </span>
                        <span className="schedule-comment-text">
                          {c.content}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="schedule-comment-form">
                  <input
                    type="text"
                    placeholder="Add a little note…"
                    value={commentText[post.id] || ""}
                    onChange={(e) =>
                      handleCommentChange(post.id, e.target.value)
                    }
                  />
                  <button type="button" onClick={() => submitComment(post.id)}>
                    Send
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <button
        type="button"
        className="schedules-fab"
        onClick={onCreateNew}
      >
        +
      </button>
    </div>
  );
}

function App() {
  const [currentUserId, setCurrentUserId] = useState(() => {
    try {
      if (typeof window !== "undefined") {
        return localStorage.getItem("ffm_user") || "veyd";
      }
    } catch {
      // ignore
    }
    return "veyd";
  });
  const currentUser = USERS[currentUserId];

  const [direction, setDirection] = useState("nyuToIu");
  const [plans, setPlans] = useState(getEmptyPlans);
  const [view, setView] = useState("schedules");
  const [scheduleDirection, setScheduleDirection] = useState("nyuToNyu");
  const [existingScheduleId, setExistingScheduleId] = useState(null);
  const [existingPostId, setExistingPostId] = useState(null);
  
  useEffect(() => {
    async function fetchPlans() {
      try {
        const { data, error } = await supabase
          .from("trip_plans")
          .select("*")
          .eq("profile_key", PROFILE_KEY);

        if (error) {
          console.error("Error loading trip plans from Supabase", error);
          return;
        }

        if (!data || !Array.isArray(data)) return;

        setPlans((prev) => {
          const next = { ...prev };

          const nyuToIuRow = data.find((row) => row.direction === "nyuToIu");
          const iuToNyuRow = data.find((row) => row.direction === "iuToNyu");

          if (nyuToIuRow) {
            next.nyuToIu = {
              activity: Array.isArray(nyuToIuRow.activity)
                ? nyuToIuRow.activity
                : nyuToIuRow.activity
                ? [nyuToIuRow.activity]
                : [],
              vibe: nyuToIuRow.vibe ?? "",
              food: Array.isArray(nyuToIuRow.food)
                ? nyuToIuRow.food
                : nyuToIuRow.food
                ? [nyuToIuRow.food]
                : [],
              locked: nyuToIuRow.locked ?? false,
            };
          }

          if (iuToNyuRow) {
            next.iuToNyu = {
              activity: Array.isArray(iuToNyuRow.activity)
                ? iuToNyuRow.activity
                : iuToNyuRow.activity
                ? [iuToNyuRow.activity]
                : [],
              vibe: iuToNyuRow.vibe ?? "",
              food: Array.isArray(iuToNyuRow.food)
                ? iuToNyuRow.food
                : iuToNyuRow.food
                ? [iuToNyuRow.food]
                : [],
              locked: iuToNyuRow.locked ?? false,
            };
          }

          return next;
        });
      } catch (e) {
        console.error("Unexpected error loading trip plans", e);
      }
    }

    fetchPlans();
  }, []);

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("ffm_user", currentUserId);
      }
    } catch {
      // ignore
    }
  }, [currentUserId]);

  const currentPlan = plans[direction];
  const canLock =
    Array.isArray(currentPlan.activity) &&
    currentPlan.activity.length > 0 &&
    currentPlan.vibe &&
    Array.isArray(currentPlan.food) &&
    currentPlan.food.length > 0;

  const savePlanToSupabase = async (directionKey, planValues) => {
    try {
      const { error } = await supabase.from("trip_plans").upsert(
        {
          profile_key: PROFILE_KEY,
          direction: directionKey,
          activity: Array.isArray(planValues.activity)
            ? planValues.activity
            : planValues.activity
            ? [planValues.activity]
            : [],
          vibe: planValues.vibe || null,
          food: Array.isArray(planValues.food)
            ? planValues.food
            : planValues.food
            ? [planValues.food]
            : [],
          locked: !!planValues.locked,
        },
        { onConflict: "profile_key,direction" }
      );

      if (error) {
        console.error("Error saving trip plan to Supabase", error);
      }
    } catch (e) {
      console.error("Unexpected error saving trip plan", e);
    }
  };

  const updatePlanField = (field, value) => {
    setPlans((prev) => {
      const updated = {
        ...prev,
        [direction]: {
          ...prev[direction],
          [field]: value,
        },
      };

      savePlanToSupabase(direction, updated[direction]);

      return updated;
    });
  };

  const handleLockIn = () => {
    if (!canLock) return;

    updatePlanField("locked", true);

    setTimeout(() => {
      const el = document.getElementById("summary-section");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 50);
  };

  const handleDirectionChange = (newDirection) => {
    setDirection(newDirection);
  };

  const startNewPlan = () => {
    setPlans(getEmptyPlans());
    setDirection("nyuToIu");
    setView("planner");
  };  

  const openScheduleForCurrent = () => {
    setExistingScheduleId(null); // force a fresh schedule
    setExistingPostId(null);
    setScheduleDirection(direction);
    setView("schedule");
  };

  const openSavedSchedule = (scheduleId, directionKey, postId) => {
    setExistingScheduleId(scheduleId);
    setExistingPostId(postId);
    setScheduleDirection(directionKey);
    setView("schedule");
  };

  return (
    <>
      <div className="sky-gradient" />

      <main className="app">
        <div className="user-toggle">
          <span className="user-toggle-label">You are:</span>
          <button
            type="button"
            className={
              "user-toggle-pill" +
              (currentUserId === "veyd" ? " user-toggle-pill--active" : "")
            }
            onClick={() => setCurrentUserId("veyd")}
          >
            Veyd
          </button>
          <button
            type="button"
            className={
              "user-toggle-pill" +
              (currentUserId === "manasi" ? " user-toggle-pill--active" : "")
            }
            onClick={() => setCurrentUserId("manasi")}
          >
            Manasi
          </button>
        </div>

        {view === "planner" && (
          <>
            <header className="app-header">
              <button
                type="button"
                className="schedule-back-button"
                onClick={() => setView("schedules")}
              >
                ← Back to schedules
              </button>
              <div className="logo">
                <span className="logo-plane">✈️</span>
                <span className="logo-text">Our Trip Planner</span>
              </div>
              <div className="tagline">
                Help me plan our next trip exactly how you want it.
              </div>
            </header>

            <section className="card planner-card">
              <div className="direction-toggle">
                <button
                  type="button"
                  className={
                    "direction-pill" +
                    (direction === "nyuToIu" ? " direction-pill--active" : "")
                  }
                  onClick={() => handleDirectionChange("nyuToIu")}
                >
                  NYU → IU
                </button>
                <button
                  type="button"
                  className={
                    "direction-pill" +
                    (direction === "iuToNyu" ? " direction-pill--active" : "")
                  }
                  onClick={() => handleDirectionChange("iuToNyu")}
                >
                  IU → NYU
                </button>
              </div>

              <p className="planner-intro">
                I’m really sorry about canceling this trip. You had every right
                to be excited and every right to be upset. I can’t un-do what
                happened, but I can make sure the next one — whether it&apos;s{" "}
                {DIRECTION_LABELS.nyuToIu} or {DIRECTION_LABELS.iuToNyu} —
                is built around what <span className="highlight">you</span> want.
              </p>

              <p className="planner-intro planner-intro--secondary">
                Right now you&apos;re planning:{" "}
                <strong>{DIRECTION_LABELS[direction]}</strong>. Help future
                travel agent Veyd design this part of our trip:
              </p>

              <OptionGroup
                title="1. What are we doing?"
                subtitle="Pick the main things you want us to do."
                options={ACTIVITIES}
                selected={currentPlan.activity}
                onSelect={(value) => updatePlanField("activity", value)}
                placeholder="Custom plan — tell me what you want to do"
                multi={true}
              />

              <OptionGroup
                title="2. What’s the vibe?"
                subtitle="How do you want the day to feel?"
                options={VIBES}
                selected={currentPlan.vibe}
                onSelect={(value) => updatePlanField("vibe", value)}
                placeholder="Describe the vibe in your own words"
              />

              <OptionGroup
                title="3. What are we eating?"
                subtitle="The truly critical decision."
                options={FOODS}
                selected={currentPlan.food}
                onSelect={(value) => updatePlanField("food", value)}
                placeholder="Any cravings I missed?"
                multi={true}
              />

              <button
                type="button"
                className="primary-button lock-button"
                disabled={!canLock}
                onClick={handleLockIn}
              >
                {canLock
                  ? `Lock in this ${DIRECTION_LABELS[direction]} plan`
                  : "Pick something in each section"}
              </button>

              {!canLock && (
                <p className="helper-text">
                </p>
              )}

              {currentPlan.locked && (
                <button
                  type="button"
                  className="schedule-open-button"
                  onClick={openScheduleForCurrent}
                >
                  Open day schedule for this trip
                </button>
              )}
            </section>

            <section
              id="summary-section"
              className={
                "card summary-card" +
                (currentPlan.locked ? " summary-card--visible" : "")
              }
            >
              {currentPlan.locked ? (
                <>
                  <h2>
                    Deal. Our next {DIRECTION_LABELS[direction]} trip looks like
                    this:
                  </h2>
                  <ul className="summary-list">
                    <li>
                      <span className="summary-label">Activity:</span>{" "}
                      {Array.isArray(currentPlan.activity)
                        ? currentPlan.activity.join(", ")
                        : currentPlan.activity}
                    </li>
                    <li>
                      <span className="summary-label">Vibe:</span>{" "}
                      {currentPlan.vibe}
                    </li>
                    <li>
                      <span className="summary-label">Food:</span>{" "}
                      {Array.isArray(currentPlan.food)
                        ? currentPlan.food.join(", ")
                        : currentPlan.food}
                    </li>
                  </ul>
                  <p className="summary-text">
                    I’m saving this as an actual promise, not just a cute
                    website. Next time there’s even a chance I can come see you
                    (or you can come see me), I’m using this as my checklist and
                    my motivation.
                  </p>
                  
                </>
              ) : (
                <>
                  <h2>
                    Our next {DIRECTION_LABELS[direction]} trip goes here.
                  </h2>
                  <p className="summary-text">
                    Once you choose everything and lock it in, I’ll treat this
                    like my official itinerary.
                  </p>
                </>
              )}
            </section>
          </>
        )}

        {view === "schedule" && (
          <ScheduleView
            direction={scheduleDirection}
            plan={plans[scheduleDirection]}
            onBack={() => {
              setExistingScheduleId(null);
              setExistingPostId(null);
              setView("schedules");
            }}
            onOpenSchedules={() => {
              setExistingScheduleId(null);
              setExistingPostId(null);
              setView("schedules");
            }}
            existingScheduleId={existingScheduleId}
            existingPostId={existingPostId}
            readOnly={!!existingScheduleId}
            currentUser={currentUser}
          />
        )}

        {view === "schedules" && (
          <SchedulesPage
            onCreateNew={startNewPlan}
            onOpenSchedule={openSavedSchedule}
            currentUser={currentUser}
          />
        )}
      </main>
    </>
  );
}

export default App;